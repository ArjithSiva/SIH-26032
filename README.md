# Kalanjiyam — Smart Procurement Queue Management System

Built for SIH Problem Statement 26032. A single procurement backend served two
ways, so no farmer is excluded by lack of a smartphone:

- **Web app** (React) — for farmers with a smartphone
- **Browser-based IVR simulator** — simulates dialing in and using a phone
  keypad, in Tamil/English/Hindi/Telugu, hitting the exact same booking APIs
- **Notification simulator** — SMS/WhatsApp/push messages are generated and
  shown live in the UI instead of going through a paid telecom provider

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the full step-by-step guide to
getting this live on MongoDB Atlas + Render + Vercel.

## Project structure

```
procurement-system/
├── backend/     Node.js + Express + MongoDB + Socket.IO API
├── frontend/    React + Vite + Tailwind CSS
└── DEPLOYMENT.md
```

## Running locally

**Backend:**
```bash
cd backend
cp .env.example .env   # then edit MONGODB_URI to point at your database
npm install
npm run seed             # one-time, safe to re-run: crop rates + admin account + one demo farmer
npm run seed:dpc         # loads the 874 real, currently-Open Tamil Nadu procurement centres
npm run dev               # http://localhost:5000
```

`npm run seed` is non-destructive (upsert-only) — safe to run on every
deploy (it's wired into the Render deploy command) without wiping real
farmers, bookings, or centres.

**You don't need to run anything else by hand.** Every time the server
starts, it automatically backfills any centre that's missing fields added in
a later version of the schema (crops list, officer password, policy limits,
working days) — see "Self-healing startup migration" below. This is what
fixes the "no crops show up" / "can't log in as a centre" symptoms without
needing shell access to Render.

Real centre data comes from TNCSC's official DPC list (Direct Procurement
Centres), Open-status only:
- `npm run seed:dpc` loads the **874-centre statewide dataset** already
  bundled in `backend/seed/data/dpc-open-full.json` (22 districts) — instant,
  no network call needed.
- `npm run scrape:dpc` re-fetches the **live** page instead, for whenever the
  season's centre list changes.

Separately, `backend/seed/data/tn-locations-full.json` holds every
taluk/village that has ever appeared in the uploaded TNCSC table (3598 rows,
any DPC status, 34 districts / 209 taluks / ~3594 villages) — used only to
power search suggestions during farmer registration. Taluk and Village
fields always also accept free text if a farmer's real taluk/village isn't
in the list (see "A note on taluk/village completeness" below).

**Frontend** (in a second terminal):
```bash
cd frontend
npm install
npm run dev              # http://localhost:5173
```

## Demo accounts (after seeding)

| Role | How to log in |
|---|---|
| Procurement centre (officer) | Pick any centre from the search list at `/officer/login`. **Each centre has its own password now** (not shared) — a fresh centre's starting password is shown once when it's created/backfilled; admin can reset any centre's password from the Centres tab if it's been lost. |
| State admin | username `admin`, password `admin123` — **change this immediately** from the admin dashboard's Staff tab; it's a well-known string and browsers will flag it as breached. |
| Demo farmer | mobile `9876543210`, OTP-based (shown on screen in dev mode) — profile is otherwise empty, so logging in will resume the registration wizard |

## Self-healing startup migration

`backend/utils/ensureCentreDefaults.js` runs once every time the server
starts (see `server.js`). Mongoose schema defaults only apply to documents
created *after* a field was added to the schema — never retroactively — so
any centre created under an older version of this app is silently missing
whatever fields were added since. Symptoms this fixes automatically, with no
manual script to run:
- Crop dropdowns showing no options during booking (centre had no `crops[]`)
- "Invalid credentials" on every officer login attempt (centre had no
  `officerPasswordHash`)

It's safe to run on every startup: it only touches documents that are
actually missing something, checks the DB connection is actually ready
first, and never touches Centres that are already current.

## Core flows

1. **Farmer registration** (multi-step, resumable if interrupted): name,
   mobile, gender, date of birth → OTP → State/District (full 38-district
   list)/Taluk/Village (searchable, free text always allowed) → Aadhar number
   on its own page with mock-OTP verification → Patta + Chitta numbers on a
   separate page, then policy consent → preferred procurement centres
   (recommended by proximity — same village, then taluk, then district —
   pre-selected, searchable to add or remove any centre statewide).
2. **Slot booking**: date (quick-pick next 7 days, or a custom date up to 30
   days out) → crop (from the admin's official crop list, so it's never
   empty because of what one centre happens to carry) + planned quantity in
   that crop's unit (bags by default, admin-configurable) with the government
   minimum price shown live → recommended centre + slot from the farmer's own
   preferred list filtered to centres that accept that crop, with an
   automatic statewide fallback if none of them do, plus "find another
   centre" to search any centre → bank & payment details (prefilled from a
   previous booking if any) → confirm → token + printable/scannable QR gate
   pass.
3. **Booking history / tracking**: live queue position, a switch-to-shorter-
   queue prompt if a same-day slot opens up, procurement stage timeline, and
   payment status (with a clearly-labelled estimated payment date).
4. **Procurement centre (officer) login**: pick your centre from a search
   list and enter that centre's own password. Today's queue, check-in, call
   next, stage progression, quantity/value entry, payment — scoped to that
   officer's own centre only. A **Centre settings** tab lets the officer set
   their own opening/closing time, slot length, queue limit per slot, working
   days, crops + max quantity accepted, and change their centre's password —
   all bounded by limits the state admin sets for that centre.
5. **State/Master admin**: an **Overview** tab showing every centre with
   live stats, filterable by district; a **Centres** tab to add new centres
   or edit any existing one (including policy limits and resetting that
   centre's password); official crop minimum prices (per unit, e.g. per bag);
   a **Complaints** tab reviewing farmer-filed complaints against centres;
   and admin accounts, including changing your own password.
6. **Public centre schedules page** (`/centres/schedules`, no login needed):
   timings, working days, and crops accepted at every open centre. A logged-
   in farmer sees their own selected centres first, then can search/filter
   by district to find others.
7. **Report / Complaint** (farmer-only, `/farmer/complaint`): file a
   complaint about a specific centre (long wait, rude behaviour, wrong
   weight, payment delay, other); visible to the state admin, who can mark
   it in progress or resolved.
8. **IVR simulator**: identifies the caller by their registered number, no
   app required — same booking/queue/status data, reached by keypad and read
   back with the browser's built-in text-to-speech.

## Token format

Every booking gets a composite, traceable token instead of a flat counter:

```
<centre code>-<date>-<crop>-S<slot no>-Q<daily queue no>
TNJ-014-20260908-PADDY-S3-Q05
```

- **Centre code** (`TNJ-014`) is generated once when the centre is created
  (district code + sequence within that district) and never changes.
- **Slot no** (`S3`) is which of that centre's slots that day the booking is
  in, ordered by start time.
- **Daily queue no** (`Q05`) is the farmer's 1-based position among *all*
  bookings at that centre that day, across every slot — starts at 1 for the
  first farmer to book at a centre each new day, then 2, 3... Rescheduling to
  a different slot the same day keeps this number; only the slot segment
  changes.

## Accessibility & language

- A "Skip to main content" link (visible on keyboard focus) and a `<main>`
  landmark are present on every page.
- A floating "Listen to this page" button reads the current page aloud in
  the farmer's chosen language, using the browser's built-in speech
  synthesis — no extra service or cost.
- The Google Website Translator widget (in the navbar) can translate the
  entire site, including most form labels and buttons, into Tamil, Hindi,
  Telugu, Kannada or Malayalam. This is a different tool from the Google
  Cloud Translation API used for IVR prompts below — it's Google's own free
  whole-page translator widget, chosen because it covers the whole UI
  without hand-wiring every string through a translation call. Its one
  known limitation: because it rewrites live DOM text nodes, very rarely a
  page navigation immediately after switching languages can throw a
  harmless console error - refreshing the page clears it.
- Every route sets its own `document.title`.
- The footer at the bottom of every page includes ownership, contact, and
  accessibility-statement placeholders in the shape GIGW (Guidelines for
  Indian Government Websites) expects — replace the placeholder department
  name/contact details with the real ones before any live deployment.

## Design notes

- Slot recommendation is a simple, explainable rule (lowest expected wait
  from farmers already booked in that slot) — intentionally not ML, per the
  brief.
- IVR "voice prompts" use the browser's `speechSynthesis` API against
  predefined, translated text per step for the four core languages. For any
  other language, the backend translates the English prompt on the fly via
  the Google Cloud Translation API (`backend/utils/translateService.js`) -
  used instead of BHASHINI, which isn't approved for use yet. Set
  `GOOGLE_TRANSLATE_API_KEY` in `.env` to enable it; with no key set, prompts
  simply stay in English for unlisted languages rather than erroring.
- Farmer bank details are captured during **booking**, not registration, and
  stored on the farmer profile (so later bookings prefill it) with a masked
  snapshot kept on each individual booking for payment history.
- Crop quantities are unit-based (bag by default, set per crop by the admin
  along with an optional reference kg-per-unit), not hardcoded to kilograms,
  since that's not how farmers here describe what they're bringing.
- Each procurement centre has its own login password (not a single shared
  one) — settable by the state admin for any centre, or by that centre's own
  officer for itself once they know the current one. A centre's starting
  password is shown once, either when it's created through the admin panel
  or the first time the self-healing migration backfills an older centre
  that never had one.
- `backend/utils/tnGeo.js` holds the full, static list of all 38 Tamil Nadu
  districts (independent of which districts currently have an open DPC
  centre), so registration never blocks a farmer based on where centres
  happen to exist right now.
- A note on taluk/village completeness: the app ships with every taluk/
  village that actually appears in the TNCSC data you uploaded (209 taluks,
  ~3594 villages, real and verified). Public sources for a complete official
  list of all Tamil Nadu taluks disagreed with each other by a wide margin
  (found counts from ~117 to 380+, depending on whether recent splits are
  counted), so rather than risk seeding incorrect names into a government-
  facing app, taluk/village fields always fall back to free-text entry
  ("not on the list? just type your own") wherever the bundled data doesn't
  have a match.
