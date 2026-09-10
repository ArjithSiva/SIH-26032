# Changes this session

Verified with: `node --check` + a standalone `require()` of every touched
backend module (all load cleanly), and a full `npm run build` in
`frontend/` (231 modules, builds clean, no errors). No live MongoDB was
available in this sandbox, same limitation as the previous session - **test
the full flow live after deploying**, especially the new multipart
land-records submission and the Bhashini calls.

## Phase 1 - bug fixes

- **"Only 3 centres show up"**: root cause was that `npm run seed:dpc` (the
  script that loads the real 874 centres) is a separate manual step that
  most likely was never run against your live database - only the 3-fake-
  centre baseline seed ever ran automatically on deploy. Fixed by moving
  the loading logic into `backend/utils/loadDpcCentres.js`, which now runs
  automatically on every server startup (same pattern as
  `ensureCentreDefaults.js`), so this can't silently regress again. The old
  `npm run seed:dpc` script still works too, as a manual force-refresh.
- **NaN minimum support price**: `upsertCropRate` only checked
  `ratePerUnit == null`, which lets `NaN` through (`NaN == null` is
  `false`). At some point a non-numeric value got typed into the rate field
  and was saved as a literal `NaN`. Fixed the validation (now checks
  `Number.isFinite(...) && > 0`) and added `ensureCropRateDefaults.js`, a
  startup migration that repairs any rate already broken this way,
  restoring the known defaults for Paddy/Maize/Groundnut and clearly
  logging anything else for manual review (there's no safe default to
  invent for an unknown crop).
- Added a real inline **Edit** button to each crop rate row (new
  `PUT /api/admin/crop-rates/:id`), instead of the old "retype the exact
  crop name into the add form" workaround.
- Complaints tab: added **Category** and **Centre** filters (Status
  filtering already existed in the backend, just wasn't exposed in the UI).

## Phase 2 - registration flow

- `Farmer` model: added `pincode`, and the land's own `landDistrict`/
  `landTaluk`/`landVillage` (separate from residence, since land can be
  elsewhere), `landTenure` (`owned`/`leased`/`rented`), and
  `leaseDocumentPath`.
- Land step now asks for the land's District/Taluk/Village *before* Patta/
  Survey-Chitta number, a Pincode field was added to the Location step, and
  a Leased/Rented option requires uploading a lease/rental agreement
  (PDF/JPEG/PNG, 5MB limit, via `multer`).
- **Action needed / heads-up**: file uploads are stored on local disk under
  `backend/uploads/`. Render's default web service disk is **ephemeral** -
  uploaded documents will not survive a redeploy or restart unless you add
  a persistent disk (Render's paid disk add-on) or switch to object storage
  (S3, Cloudinary, etc.). The rest of the app only ever deals with the
  relative path this middleware returns, so swapping the storage backend
  later is a one-file change (`backend/middleware/upload.js`), not a
  rewrite.

## Phase 3 - policy limit cascade

- When admin changes a centre's `policyLimits`, any of that centre's
  current operational settings (opening/closing time, slot duration,
  capacity per slot) that now fall outside the new bounds are clamped to
  the new bound immediately, so the centre stays operational without a
  manual follow-up. The officer can still adjust their own settings again
  afterwards, within the new bounds.

## Phase 4 - Bhashini migration

- `backend/utils/bhashiniClient.js`: new client implementing the two-step
  ULCA auth flow (your `userID` + `ulcaApiKey` -> Pipeline Config endpoint
  -> a third `inferenceApiKey` it hands back, used for the actual
  translate/TTS calls). Set `BHASHINI_USER_ID` and `BHASHINI_API_KEY` in
  your environment - see `backend/.env.example`.
- `translateService.js` now delegates to Bhashini instead of Google, with
  the exact same function signatures, so every existing caller (IVR
  prompts) needed zero changes.
- New `POST /api/ivr/speak` endpoint: real Bhashini TTS audio, with
  graceful fallback to browser `speechSynthesis` if Bhashini isn't
  configured or a call fails. Both the site's read-aloud button
  (`VoiceOverButton.jsx`) and the IVR simulator now use this.
- **Found and fixed a real gap while doing this**: the IVR simulator never
  actually spoke out the dynamic option lists (centre names, dates, slot
  times) - only the generic "please choose from the list" prompt. On an
  actual phone call (as opposed to this browser simulator, which also shows
  the options visually) that would have been unusable. It now reads out
  every option.
- Site-wide translation: replaced the Google Website Translator widget with
  a small custom i18n system - `LanguageContext.jsx` + per-language JSON
  dictionaries in `frontend/src/locales/`, generated from the English
  source file via `npm run generate:translations` (in `backend/`), which
  calls Bhashini and only re-translates strings that changed since the
  last run.
  **Scope note**: this is a real, working pattern, wired into the Navbar
  and homepage - but migrating every single string on every page into the
  dictionary (so the whole site is covered) is a large, mechanical task
  that wasn't completed in this pass. Anything not yet using `t('key')`
  still renders in English regardless of the selected language. Worth a
  dedicated follow-up pass, page by page.
- **Action needed**: run `npm run generate:translations` (from `backend/`)
  once your Bhashini keys are set, to produce real `ta`/`hi`/`te`
  translations - right now those files are English-text placeholders so
  the app builds without the keys.

## Phase 5 - redesign

- Background switched to white (was a warm off-white) per your request;
  the existing green/gold palette and Noto Sans(+Indic) typography were
  already following a GIGW-adjacent standard, so this was a smaller change
  than a full re-theme.
- Added a slim government identity strip (`GovHeader.jsx`) above the main
  nav, per GIGW guidance - **placeholder department name, needs the real
  department details before go-live**, same caveat the previous session
  already flagged for the footer.
- Navbar: procurement-centre and admin login links removed entirely
  (`/officer/login` and `/staff/login` still work, just aren't linked from
  anywhere) - added a farmer "My profile" link and a language switcher, and
  a mobile hamburger menu.
- Homepage rewritten: dropped the role-selection cards and project
  description, now leads with farmer-facing features only.
- New farmer profile page (`/farmer/profile`): view/edit personal details,
  residence address, bank details (each section saves independently); land
  records are shown read-only for now (editing land tenure requires
  re-uploading the lease document, which didn't fit this pass - reuse the
  registration land step for that until a dedicated edit form is built).
- Because the officer/admin dashboards share the same global theme
  (`.card`, `.btn-primary`, etc. and the Tailwind color/background
  variables) rather than their own styling, they inherited the white
  background and palette automatically - verified there's no
  page-specific hardcoded background overriding it.
- **Scope note**: matching the provided mockups' exact layout (bottom-sheet
  menu style, phone-mockup card layouts, etc.) page-by-page across the
  entire farmer flow, and a full pass of officer/admin-specific layout
  polish, wasn't completed in this pass - the shared theme/nav/homepage
  changes above are the foundation, but a dedicated design pass per page
  would still be worth doing.

## Also touched

- `multer` pinned to the patched `^2.0.0` line (the first version installed
  via `^1.4.5-lts.1` triggered an npm vulnerability warning).
- Added a root `.gitignore` (`node_modules/`, `dist/`, `.env`,
  `backend/uploads/*`) - none existed before.

## Session 2 fixes (registration bug, Bhashini credentials, homepage changes)

- **Fixed the real bug behind "pattaNumber and chittaNumber are required"
  persisting no matter what was typed**: `Register.jsx`'s land-records
  submit explicitly set `Content-Type: multipart/form-data` on the axios
  request. Doing that on a `FormData` body strips out the boundary the
  browser would otherwise attach automatically, so the server couldn't
  parse ANY field out of the request - not just Patta/Chitta, every field
  came through empty. Fix: don't set the header manually, let
  axios/the browser generate it (with the correct boundary) from the
  `FormData` object itself.
- **Bhashini credentials clarified for the "Udyat" onboarding dashboard**
  (a newer, differently-branded Bhashini portal than the classic ULCA "My
  Profile" page most tutorials describe - the underlying API is the same
  ULCA pipeline-config/compute flow, confirmed against Bhashini's own
  GitBook docs): `BHASHINI_USER_ID` = the long ID shown under your app's
  name on that dashboard, `BHASHINI_API_KEY` = the "UDYAT KEY" value. The
  "INFERENCE" key shown there is fetched by the app itself at runtime, not
  needed in `.env`. See the updated comments in `backend/.env.example`.
  **Important**: your dashboard's own "Key Request Details" shows CEO
  approval done but Manager's Approval still Pending - that's almost
  certainly why nothing is working yet, independent of any code or .env
  correctness. Added `node scripts/testBhashini.js` (run from the project
  root) to hit the API directly and print the real HTTP status/error, so
  it's easy to tell an approval-pending 401/403 apart from a genuine
  misconfiguration once you're ready to check again.
- Also fixed `generate:translations` not picking up `backend/.env` at all
  (it only read `process.env`, and nothing exports the `.env` file's
  values into the shell) - it now reads `backend/.env` directly.
- **Site-wide translation expanded to all 22 Eighth Schedule languages**
  (previously only en/ta/hi/te) - `LanguageContext.jsx` now auto-discovers
  every generated locale file, and `generate:translations` produces all 22.
  The IVR simulator is deliberately unchanged and still only offers its
  original en/ta/hi/te, since those are the ones with hand-verified prompt
  text (see `ivrController.js`) - it does not read this 22-language list.
- **Removed the site-wide read-aloud button** (`VoiceOverButton`) from
  every page, per your latest instruction - the underlying Bhashini
  TTS/`/ivr/speak` endpoint stays, since the IVR simulator still uses it.
- **Homepage**: added an IVR demo section/link, and moved procurement-centre
  and admin sign-in links onto the homepage specifically (still their own
  separate `/officer/login` and `/staff/login` pages) - they remain out of
  the main Navbar shown on every other page, per the earlier instruction to
  keep them out of general navigation.
- **Found and fixed a real deploy-time risk while working on the above**:
  the startup migrations (`loadDpcCentres`, etc.) were blocking
  `server.listen()` until they finished. `loadDpcCentres`'s very first run
  ever does hundreds of database round trips - slow enough on a free
  Render instance talking to a free-tier Atlas cluster to risk failing
  Render's health check before the port even opens. Fixed two ways: (1)
  the server now starts listening immediately and runs migrations in the
  background afterward; (2) rewrote `loadDpcCentres` to use a single
  `bulkWrite` instead of roughly 1,700 sequential per-row queries.
  **You do not need to change your Render Build Command for centres to
  load** - this now happens automatically the moment the updated code
  boots. If you want extra redundancy on a free tier anyway, you can add
  `&& npm run seed:dpc` to the Build Command, but it's optional.

