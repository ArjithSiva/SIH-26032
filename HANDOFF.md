# Project handoff: HarvQ — Smart Procurement Queue Management System (SIH PS 26032)

I'm continuing work on this project from previous conversations. Attach the
latest `procurement-system-updated.zip` and continue from here.

## Stack
- Backend: Node.js + Express + MongoDB (Mongoose) + Socket.IO, deployed on
  Render (free tier)
- Frontend: React + Vite + Tailwind CSS, deployed on Vercel
- Browser-based IVR simulator (keypad + real Bhashini TTS with browser
  speechSynthesis fallback) and a live notification simulator (fake
  SMS/WhatsApp/push via Socket.IO)
- Bhashini ("Udyat" onboarding dashboard) for translation + TTS, replacing
  the Google Translate/TTS this app originally shipped with

For running this locally instead of the hosted Render/Vercel setup
(e.g. a hackathon demo on venue wifi, MongoDB Atlas still used as the
database) - see `LOCAL_DEMO.md`.

## What's built (high level, cumulative across all sessions)
- **Farmer flow**: multi-step registration (name/mobile/gender/DOB → OTP →
  State/District/Taluk/Village/**Pincode** → Aadhar+OTP on its own page →
  Land records on its own page → policy consent → preferred centres →
  slot booking → bank details → confirm → token + QR gate pass) → booking
  history, payment status, report/complaint page, and a **farmer profile
  page** (view/edit personal details, address, bank details; land records
  shown read-only).
  - Land records step now asks for the **land's own District/Taluk/Village
    first** (separate from residence — land can be elsewhere), then
    Patta number and Survey/Chitta number, then **Owned/Leased/Rented**,
    with a required lease/rental agreement upload (PDF/JPEG/PNG, 5MB) for
    Leased/Rented.
- **Procurement centre (officer) login**: per-centre password
  (`centre123` default via `DEFAULT_OFFICER_PASSWORD` env var), dashboard
  scoped to their own centre, Centre Settings tab bounded by admin-set
  policy limits. **When admin tightens a centre's policy limits, that
  centre's own settings are force-clamped to the new bounds immediately**
  so it stays operational without a manual follow-up.
- **State/Master admin login**: Overview, Centres (add/edit/reset
  password), Crop rates (with a real inline **Edit** button now, not just
  the old retype-to-upsert trick), Complaints (now with Status/Category/
  Centre filters), Staff.
- **Public pages**: centre schedules, IVR demo (now linked from the
  homepage).
- **Homepage**: rewritten to lead with farmer-facing features only. An IVR
  demo link and separate Procurement-centre-staff / State-admin login
  links live here specifically — **not** in the main nav shown on every
  other page (that nav is farmer-only by design: home, book slot, my
  bookings, payments, report issue, profile).
- **Site-wide translation**: custom i18n system (`LanguageContext.jsx` +
  per-language JSON files in `frontend/src/locales/`, generated via
  `npm run generate:translations`, which calls Bhashini). Covers **22
  languages of the Eighth Schedule** plus English. **Only a handful of
  strings (Navbar + homepage) are actually migrated to use `t('key')` so
  far** — everything else on every other page still renders in English
  regardless of the selected language. This is the single biggest
  remaining piece of unfinished work.
- **IVR**: deliberately kept to its own separate, smaller, hand-verified
  language set (en/ta/hi/te only — not the 22-language site list). Now
  actually speaks out dynamic option lists (centre names, dates, slot
  times) via Bhashini TTS with a small localized connector-phrase
  dictionary — it never did this before, a real gap found and fixed this
  session.
- **Removed entirely, per explicit instruction**: the on-page "read this
  page aloud" button (`VoiceOverButton`) that used to appear on every
  farmer-facing page. IVR's own TTS is unaffected.
- **Token format**: `<centre-code>-<date>-<crop>-S<slot-no>-Q<daily-queue-no>`,
  daily queue number 1-based per centre per day, survives same-day
  reschedule.
- **Data**: real 874 currently-Open TNCSC DPC centres, now loaded
  **automatically on every server startup** (see Critical fixes below) —
  no manual seed script needed for a normal deploy.

## Critical fixes made across recent sessions (read this carefully)

1. **"Only 3 centres show up" — root cause and fix**: the real 874-centre
   dataset was only ever loaded by a manual script (`npm run seed:dpc`)
   that most likely was never run against the live database — only a
   3-fake-centre baseline seed ran automatically on deploy. Fixed by
   moving the load into `backend/utils/loadDpcCentres.js`, which now runs
   automatically every time the server starts. **You should not need to
   touch your Render Build Command for this** — it happens at process
   startup, not build time.
2. **Startup-blocking risk found and fixed**: that same automatic load
   used to run *before* `server.listen()`, and its very first run ever
   does hundreds of DB writes — slow enough on a free Render + free Atlas
   combo to risk failing Render's health check before the port opens.
   Fixed: the server now listens immediately, migrations run in the
   background afterward, and the centre load itself was rewritten to use
   one `bulkWrite` instead of ~1,700 sequential queries.
3. **NaN minimum support price — root cause and fix**: `upsertCropRate`
   only checked `ratePerUnit == null`, which lets `NaN` silently through
   (`NaN == null` is `false`). A stray non-numeric value once got saved as
   a literal `NaN`. Fixed the validation and added a startup migration
   (`ensureCropRateDefaults.js`) that repairs any rate already broken this
   way, restoring known defaults for Paddy/Maize/Groundnut.
4. **Registration silently rejecting every land-record submission — root
   cause and fix**: `Register.jsx`'s land-records step explicitly set
   `Content-Type: multipart/form-data` on the axios request carrying a
   `FormData` body. That strips the boundary the browser would otherwise
   attach automatically, so the server couldn't parse *any* field out of
   the request — not just Patta/Chitta, everything came through empty,
   which is why "pattaNumber and chittaNumber are required" persisted no
   matter what was typed. Fixed by not setting that header manually.
5. **`generate:translations` silently translating 0/29 keys for every
   language — root cause and fix**: the script wrote a
   `.en.snapshot.json` cache file unconditionally, even on a run with no
   Bhashini keys configured (which just copies English text into every
   locale file as a placeholder so the app builds). The next run — even
   once real keys were added — saw that placeholder English text already
   sitting in `ta.json`/`hi.json`/etc., compared it against the snapshot,
   found no difference, and concluded nothing needed translating.
   **Fixed properly** (the snapshot is now only written after a run that
   actually had working keys) — deleting `.en.snapshot.json` by hand is
   no longer necessary going forward, though it's a harmless no-op if you
   still do it out of habit.
6. Officer/centre passwords: per-centre (not shared), `centre123` default
   via `DEFAULT_OFFICER_PASSWORD`, with `mustChangeOfficerPassword` set on
   any auto-created centre.
7. **Queue-tracking gaps and two authorization bugs, found and fixed**:
   booking cancellation didn't exist at all (the schema had a `cancelled`
   status, nothing ever set it); marking a farmer absent never freed
   their slot's capacity; the "farmers ahead of you" count used booking
   time instead of check-in time; the `queue:update` Socket.IO event was
   emitted on every queue change but had zero listeners anywhere in the
   frontend (compounded by the socket never rejoining its room after a
   page refresh); and any farmer/officer could act on another farmer's
   booking or another centre's queue just by knowing its id, since the
   auth middleware only checked *role*, never *ownership*. Full detail
   in `CHANGES.md`, "Latest session, part 3". **Live-test this whole
   area first** — cancel a booking, check in two farmers and confirm
   call order matches check-in time, and open the officer dashboard in
   two tabs to confirm one's actions now appear live in the other.

## Bhashini integration status

- Dashboard used is the **"Udyat" onboarding portal** (a newer, differently
  -branded Bhashini dashboard than the classic ULCA "My Profile" page most
  tutorials describe) — confirmed against Bhashini's own GitBook docs that
  the underlying API is still the same ULCA Pipeline-Config → Pipeline-
  Compute flow.
- **Env var mapping**: `BHASHINI_USER_ID` = the long ID shown under your
  app's name on that dashboard ("harvq"); `BHASHINI_API_KEY` = the
  "UDYAT KEY" value shown there. The "INFERENCE" key on that same
  dashboard is **not** needed in `.env` — the app fetches the equivalent
  value itself at runtime via the Pipeline Config call.
- **As of the last check, your key's "Manager's Approval" was still
  Pending** (CEO approval was done) on the Key Request Details panel —
  this is almost certainly why translate/TTS calls were failing,
  independent of any .env correctness. Run `node scripts/testBhashini.js`
  (from the project root, `cd backend && npm install` first if needed) to
  hit the API directly and see the real HTTP status — a 401/403 there
  points at the approval status, not a config mistake.
- Once approved and confirmed working via that test script, run
  `npm run generate:translations` (from `backend/`) to produce real
  translations for all 22 languages (currently English-placeholder text
  in every locale file other than `en.json`).

## Known limitations / judgment calls to be aware of

- **No live database testing was possible** in the sandbox any of this was
  built in (no `mongod` binary, network-restricted). Verified via: syntax
  checks, loading every backend module standalone, a full `npm run build`
  of the frontend (clean, no errors both times), and a real invocation of
  `server.js` with no DB configured (confirmed it now listens immediately
  and migrations degrade gracefully) — but nothing has been exercised
  against a real MongoDB end-to-end, and Bhashini calls have not been
  exercised against a real approved key. **Test the full flow live after
  deploying, and re-test Bhashini once Manager's Approval clears.**
- **File uploads (lease/rental agreements) are stored on local disk**
  under `backend/uploads/`. Render's default web service disk is
  **ephemeral** — uploaded documents will not survive a redeploy/restart
  unless you add a persistent disk (Render's paid add-on) or switch to
  object storage (S3, Cloudinary, etc.). The app only ever deals with the
  relative path `middleware/upload.js` returns, so swapping the storage
  backend later is a one-file change.
- **Site-wide translation coverage is partial**: the i18n pattern
  (`LanguageContext` + `t('key')`) is proven and wired into Navbar +
  homepage, but migrating every string on every other page into the
  dictionary is a large, mechanical task not yet done. Anything not using
  `t('key')` renders in English regardless of selected language.
- **Farmer profile page doesn't support editing land tenure** (would
  require re-uploading the lease document, a bigger form than the other
  profile sections) — shown read-only there for now; re-run the
  registration land step to change it.
- GIGW guidelines applied as a pragmatic subset (skip link, page titles,
  footer, basic landmarks, a government identity strip above the nav with
  **placeholder department name/details** — still needs real department
  info before go-live) — not a full audit; color contrast, security
  headers (helmet/CSP), sitemap, and a full ARIA/keyboard-nav pass haven't
  been done.
- Complete official Tamil Nadu taluk list (~310) couldn't be sourced
  reliably in an earlier session — kept the 209 real, verified taluks from
  the uploaded TNCSC file plus free-text fallback everywhere.
- OTP, payments, and IVR telephony are all simulated (no real SMS gateway,
  payment gateway, or telecom/IVR provider wired in) — by design, per the
  original brief.
- No automated test suite exists — verification has been manual/code-
  review + build-check based throughout.

## Files/structure
Backend: `backend/{models,controllers,routes,middleware,utils,seed,scripts}`.
Frontend: `frontend/src/{pages,components,context,utils,hooks,api,locales}`.
Key files worth knowing about:
- `backend/utils/loadDpcCentres.js` — auto-runs at startup, loads the real
  874 centres via a single bulk write.
- `backend/utils/ensureCentreDefaults.js` / `ensureCropRateDefaults.js` —
  other self-healing startup migrations.
- `backend/utils/bhashiniClient.js` — the Bhashini/ULCA client (pipeline
  config → compute, translate + TTS).
- `backend/middleware/upload.js` — multer config for the lease-document
  upload (see the ephemeral-disk caveat above).
- `frontend/src/context/LanguageContext.jsx` — site-wide i18n, auto-
  discovers every file in `frontend/src/locales/`.
- `scripts/generateTranslations.js` — run via `npm run generate:translations`
  (from `backend/`) to (re)generate the 22 locale files via Bhashini.
- `scripts/testBhashini.js` — run via `npm run test:bhashini` (from
  `backend/`) to directly test the Bhashini connection and print the raw
  error.
- `CHANGES.md` (root) — full session-by-session changelog, more detail
  than this handoff doc.

## Next steps (pick up here)
- Confirm Bhashini Manager's Approval has cleared; run
  `npm run test:bhashini`, then `npm run generate:translations` once it
  passes.
- Deploy and smoke-test the full live flow end-to-end (registration →
  land records with a real lease-document upload → booking → officer
  processing → payment) against a real MongoDB Atlas instance.
- Decide on and set up persistent file storage for lease documents before
  relying on real farmer uploads (see the ephemeral-disk caveat).
- Continue migrating page strings into the `t('key')` i18n dictionary —
  right now only Navbar and the homepage use it; every other farmer page
  still renders in English regardless of selected language.
- Get real department name/details for the government identity strip
  (currently a placeholder) and the footer (flagged since an earlier
  session).
- [Add anything else you want changed here before I start — as before,
  I'll list out what I understand and what I'm going to change before
  touching code, so you can confirm first.]
