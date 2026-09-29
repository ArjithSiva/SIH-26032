# Changes this session

## Latest session, part 9 - Frontend on localhost with the backend on Render

Goal: present with the browser showing `http://localhost:5173` while the
backend stays hosted on Render. The frontend already read its API address
from `VITE_API_BASE_URL`, so most of this is configuration - but one real
code limitation stood in the way:

**`CORS_ORIGIN` could only hold one origin.** `server.js` passed it
straight to `cors({ origin })` and to Socket.IO as a single string, so a
Render backend could allow either the deployed Vercel site or a laptop
running on `localhost`, never both. It now accepts a comma-separated list
(`https://site.vercel.app,http://localhost:5173`), trims whitespace and
strips trailing slashes (a stray `/` in the env var would otherwise
silently never match, since browsers never send one in `Origin`), and
still means "allow any origin" when unset. Applied to both Express CORS
and Socket.IO so live queue/notification updates work from localhost too.
Live-tested with real `curl` requests carrying `Origin` headers:
`localhost:5173` allowed, the Vercel origin allowed even when written with
a trailing slash, an unknown origin blocked, the Socket.IO handshake
returns the right header, and unset still returns `*`.

**Vite now uses `strictPort`.** Previously, if port 5173 was busy Vite
quietly moved to 5174 - and Render's allowlist names `localhost:5173`
exactly, so every API call would fail with a confusing CORS error
mid-demo. It now refuses to start with "Port 5173 is already in use".
Verified by occupying the port and starting Vite.

Also added: `frontend/.env.example` (documents `VITE_API_BASE_URL`; verified
a value in `frontend/.env` is baked into the production bundle), a root
`npm run dev:frontend` script (frontend only - `npm run dev` also starts a
local backend), the multi-origin syntax documented in
`backend/.env.example`, and a full "Frontend on localhost, backend on
Render" section in `LOCAL_DEMO.md` (Render CORS setting, `.env` setup,
waking the free-tier service before presenting, troubleshooting).

Found while doing this: the project had **no `.gitignore` at all**, so
`backend/.env` (MongoDB credentials) and the new `frontend/.env` could
have been committed. Added a root `.gitignore` covering `node_modules`,
`dist`, all `.env` files (not the `.example` templates) and runtime
`backend/uploads/` (safe: `middleware/upload.js` recreates those folders
with `mkdirSync({ recursive: true })`). If either `.env` was already
committed in your repo, adding `.gitignore` doesn't remove it from
history - rotate that MongoDB password.

Files touched: `backend/server.js`, `backend/.env.example`,
`frontend/vite.config.js`, `frontend/.env.example` (new), `package.json`
(root), `LOCAL_DEMO.md`, `.gitignore` (new).

## Latest session, part 8 - Fixed a real stuck-booking dead end, reworded officer-facing "admin" language to "Government"

**Real bug, found from a live screenshot**: a booking whose procurement
paperwork (weighing/quality-check/completion) hadn't finished yet could
get permanently stuck with no way to move forward at all. The "advance to
next stage" button only appeared while `queueStatus === 'processing'` -
but `queueStatus` flips to `'completed'` automatically the instant
another booking sharing the same time slot gets called next (see
`queueController.callNext`'s same-slot auto-complete, from an earlier
session). If an officer moved on to the next farmer in that slot before
finishing the first one's weighing/quality steps, the first booking was
left with `procurementStage` stuck wherever it was and `queueStatus:
'completed'` - and since nothing renders that button for a `'completed'`
queueStatus, there was no way back. This exactly matched the screenshot:
two bookings showing "Stage: Checked in" with no action available at
all, unable to ever reach payment.

Root cause was conflating two different things: `queueStatus` is about
who's currently being called to the counter (a live pointer), while
`procurementStage` is the back-office paperwork pipeline - which should
be able to continue regardless of whether the live queue has since moved
on. Fixed by gating the advance-stage button on `procurementStage` alone,
only excluding a booking actually marked `absent` or `cancelled`. This
also un-sticks any booking already stranded this way in an existing
database - the button will reappear for it now, no data migration
needed.

**Wording**: reworded every place the officer's own dashboard mentioned
"admin" to instead say "the Government" - matching the request to hide
the admin-approval step as an implementation detail from the officer's
point of view. Changed: the "Send payment request..." button label, both
status notes shown under a booking's payment section ("...awaiting
admin approval" / "Admin has accepted..."), and the notification an
officer's centre receives once admin accepts a request. The shared
`status.requested` badge (visible on both the officer's queue and the
admin's own Payment Requests tab) was changed to the neutral "Payment
requested" rather than either "Sent to admin" or "Sent to the
Government" - the latter would have been actively misleading on admin's
own screen, since from admin's side the request hasn't been sent to the
government at all until *they* accept it. Admin's own dashboard copy
("Payment requests" tab, "Accept & send to government" button) is
unchanged - admin needs the exact/accurate view of what's happening.

Verified with `node --check` + a standalone `require()` of the modified
backend file plus the full `server.js` (loads and starts clean), and a
full `npm run build` of the frontend (610 modules, no errors). No live
MongoDB testing was possible in this sandbox - worth re-checking your two
previously-stuck bookings in the officer dashboard after this deploys;
their "advance stage" button should now be back.

Files touched: `frontend/src/pages/officer/Dashboard.jsx`,
`frontend/src/locales/en.json`,
`backend/controllers/paymentController.js`.

## Latest session, part 7 - Payment workflow moved from procurement centres to admin

Reworked who's actually allowed to process and complete a farmer's
payment. Previously an officer could do the entire payment lifecycle
themselves (mark it processing, then mark it paid) with no admin
involvement beyond an FYI notification (added last session). Now:

- **Officer's only payment action is "Send payment request to admin"** -
  available once procurement is complete. This is a new `paymentStatus`
  value, `requested`, sitting between `pending` and `processing` in the
  Booking model's enum. The old "start processing" / "mark paid" buttons
  and their backend route are gone from the officer's side entirely -
  `POST /api/payments/:bookingId` (the old single endpoint accepting a
  `status` body field) has been replaced with three purpose-specific
  routes with different auth requirements, not one shared route gated by
  a request body value.
- **New admin-only "Payment requests" tab and endpoints.** Admin now sees
  every booking sitting at `requested` or `processing` across *every*
  centre (`GET /api/payments/requests`), can **accept** a request
  (`POST /:id/process`, moves `requested` → `processing`, this is the
  "send it to the government" step), and then **complete** it
  (`POST /:id/complete`, moves `processing` → `completed` with the paid
  amount, this is the "finish it" step). Both are admin-only
  (`requireAuth(['admin'])`) - an officer calling either now gets 403,
  same as before by role, but now provably from route config rather than
  from the old handler happening to ignore the officer/admin distinction.
- **Notifications adjusted to match the new step boundaries**: officer's
  request → admin gets "new request awaiting review", farmer gets
  "submitted, awaiting approval". Admin's accept → farmer gets "accepted
  and sent to the government", officer's centre gets the same, so they
  know admin picked it up. Admin's complete → unchanged from last
  session (farmer + officer both get the "received in bank account"
  receipt).
- Frontend: officer's `BookingRow` payment section replaced with the
  single request button plus two read-only status messages ("awaiting
  admin approval" / "being processed with the government"). New
  `PaymentRequestsTab` in the admin dashboard (its own "Payment requests"
  tab) lists every pending/in-progress request across all centres with
  Accept and Complete actions. `StatusBadge` and its translation map
  gained a `requested` entry so it doesn't fall back to an unstyled raw
  string.

Verified with `node --check` + a standalone `require()` of every
modified/dependent backend file plus the full `server.js` (loads clean,
starts and degrades gracefully with no DB configured, same as every prior
session), and a full `npm run build` of the frontend (610 modules, clean,
no errors). No live MongoDB integration testing was possible in this
sandbox - click through the new admin tab after deploying/running
locally to confirm the accept/complete buttons behave as expected end to
end.

Files touched: `backend/models/Booking.js`,
`backend/controllers/paymentController.js`,
`backend/routes/paymentRoutes.js`,
`frontend/src/pages/officer/Dashboard.jsx`,
`frontend/src/pages/admin/Dashboard.jsx`,
`frontend/src/components/StatusBadge.jsx`,
`frontend/src/locales/en.json`.

## Latest session, part 6 - Fixed two real bugs in the offline-demo scripts (found via live Windows testing)

A live run on Windows (PowerShell) surfaced two bugs in part 5's new
root-level scripts - both are genuine bugs in what shipped, not
environment quirks, and both are fixed now:

**`npm run install:all` never installed the root's own dependencies.**
It only ran `npm install --prefix backend && npm install --prefix
frontend` - the root `package.json`'s own `devDependencies`
(`concurrently`, which `npm run dev` needs) never got installed, so `npm
run dev` failed with `'concurrently' is not recognized...`. Fixed by
adding a plain `npm install` (no prefix) as the first step. Verified with
a genuinely fresh install (removed all three `node_modules` first) -
`concurrently` now lands in the root `node_modules/.bin`.

**`SERVE_FRONTEND=true npm start --prefix backend` is Unix-shell-only
syntax.** It fails outright in PowerShell/cmd on Windows
("is not recognized as the name of a cmdlet..."), which is exactly what
the user hit. Added `cross-env` as a root dependency and two wrapper
scripts - `npm run build:offline` and `npm run start:offline` - so the
single-port demo mode works identically on Windows, Mac, and Linux
without the user ever typing a raw env-var assignment. `LOCAL_DEMO.md`'s
"Advanced" section now documents these two scripts instead of the raw
command.

Also added a short "About the npm warnings you'll see" section to
`LOCAL_DEMO.md`, since the same test run surfaced two npm warnings
(an audit vulnerability count, and an "install scripts blocked" notice
for esbuild's postinstall) that look alarming but don't actually break
anything - Vite's build completed successfully despite both, exactly as
observed.

Verified with a genuinely fresh `npm run install:all` (all three
`node_modules` removed first, confirmed `concurrently`/`cross-env` both
present afterward), a live `npm run dev` (confirmed both servers actually
start), and a live `npm run build:offline && npm run start:offline`
(confirmed `cross-env` correctly sets the variable and the single-port
mode serves both the frontend and `/health` correctly) - all on this
sandbox's Linux shell, which doesn't reproduce the original Windows
failure directly, but does confirm `cross-env` is the right fix (it's
built specifically to normalize this exact cross-shell env-var syntax
difference) and that nothing else broke.

Files touched: `package.json` (root), `LOCAL_DEMO.md`.

## Latest session, part 5 - Install-app placeholder, real farmer/officer/admin Notification Centres, full payment-notification lifecycle, offline demo mode

Four separate feature requests, verified with `node --check` on every
edited backend file, a standalone `require()` of every modified/dependent
backend module plus the full `server.js`, three live `curl` checks of the
new single-port demo mode (static file serving, SPA fallback, and the API
still responding), a live run of the new root `npm run dev` (confirmed
both servers actually start together), and a full `npm run build` of the
frontend (clean, no errors). No live MongoDB integration testing was
possible in this sandbox (same limitation as every prior session) - the
notification flows below need a real click-through after deploying/running
locally.

**1. "Install our app" button.** Added next to Register/Login on the
homepage hero. There's no app yet, so it doesn't link anywhere - clicking
it shows "Our mobile app isn't available yet - available in a future
update!" via a plain alert, matching the codebase's existing convention
for lightweight in-app messages.

**2. Real per-role Notification Centres with a Clear button.** Previously
there was no farmer-facing (or officer/admin-facing) notification inbox at
all - the only notification UI in the app was the global, unscoped demo
panel (`NotificationSimulatorPanel`) showing every notification for every
farmer to every visitor, logged in or not. Built a proper, scoped
`NotificationCentre.jsx` component (list + live Socket.IO updates + a
Clear button with a confirm prompt) and mounted it in three places:
  - Farmer's home page - their own notifications only
  - Officer dashboard - new "Notifications" tab, scoped to their own centre
  - Admin dashboard - new "Notifications" tab, a shared admin inbox

This needed a real schema change, since `Notification.farmer` was
`required: true` - there was no way to address a notification at an
officer or admin at all. Added `recipientRole` (`farmer` / `officer` /
`admin`) to the model, made `farmer`/`centre` conditionally required to
match, and generalized `notificationSimulator.js` so `sendNotification`/
`broadcastEvent` route to the right Socket.IO room per role
(`farmer:<id>`, `centre:<id>`, or a shared `admin` room - added a
`join:admin` socket handler and wired `SocketContext.jsx`'s existing
auto-rejoin-on-connect logic, from last session's fix, to cover admins
too). Added matching `GET`/`DELETE` endpoints for all three roles in
`notificationController.js`/`notificationRoutes.js`, each ownership-
checked the same way as every other resource this project touches (a
farmer can only see their own; an officer only their own centre's; admin
sees the shared inbox). The old unscoped `GET /api/notifications/feed`
stays as-is, on purpose, for the demo panel.

**3. The full payment notification lifecycle now actually fires.**
Walked the three lifecycle points named and fixed each:
  - **Procurement complete** → farmer notified (existing message reworded
    to explicitly say the payment process has now been initiated, per the
    request's exact wording).
  - **Payment processing starts** (officer marks payment "processing") →
    previously sent **nothing at all**. Now: the admin gets a notification
    that a payment request for that token has been sent to the government
    for processing, and the farmer gets the equivalent message in their
    own words.
  - **Payment completed** → the farmer's existing receipt is kept (reworded
    to say "processed and received in your bank account"); the
    procurement centre/officer now **also** gets notified of the same
    completion, which it never did before despite being who'd actually
    field a farmer's in-person "did my payment come through?" question.

**4. Offline/local demo mode (no Vercel, no Render, Atlas MongoDB stays
online).** `DEPLOYMENT.md` only ever documented the hosted path. Added:
  - A root-level `package.json` (`concurrently` as its only dependency)
    with `npm run install:all` and `npm run dev` - the latter starts both
    `backend` and `frontend` dev servers together in one terminal with
    color-coded output, verified with a live run.
  - `LOCAL_DEMO.md` - the full one-time-setup-then-one-command walkthrough
    (Atlas connection string → `backend/.env` → install → seed → run),
    plus a troubleshooting section for the most likely failure modes
    (missing/placeholder `MONGODB_URI`, CORS port mismatches, port
    conflicts).
  - An optional single-port mode: `SERVE_FRONTEND=true` makes `server.js`
    serve the frontend's built `dist/` directly (with a proper SPA
    fallback for client-side routes on a hard refresh), so a demo can run
    entirely off one process/port if that's more convenient on an
    unreliable venue connection. Gated behind that env var specifically so
    it has zero effect on the real Render deployment. Verified live:
    static files serve, `/farmer/login` falls back to `index.html`
    correctly, and `/health` still responds as an API route.

Files touched: `backend/models/Notification.js`,
`backend/utils/notificationSimulator.js`, `backend/sockets/queueSocket.js`,
`backend/controllers/{notificationController,procurementController,
paymentController}.js`, `backend/routes/notificationRoutes.js`,
`backend/server.js`, `frontend/src/context/SocketContext.jsx`,
`frontend/src/components/NotificationCentre.jsx` (new),
`frontend/src/pages/Landing.jsx`,
`frontend/src/pages/farmer/Home.jsx`,
`frontend/src/pages/officer/Dashboard.jsx`,
`frontend/src/pages/admin/Dashboard.jsx`,
`frontend/src/locales/en.json`, `package.json` (new, root),
`LOCAL_DEMO.md` (new).

## Latest session, part 4 - Continued audit: unauthenticated notification endpoint

Continued the same ownership/authorization audit from part 3 across every
remaining controller (`farmerController`, `complaintController`,
`centreController`, `adminController`, `slotController`, `geoController`,
`ivrController`, `authController`). Most already had correct ownership
checks (`canAct()` in `farmerController`/`complaintController`, explicit
centre checks in `centreController`) - only one real gap turned up:

**`GET /api/notifications/farmer/:farmerId` had no authentication at
all.** Unlike every other farmer-scoped route in the app, this one wasn't
behind `requireAuth` - anyone, signed in or not, could pull any farmer's
full notification history (booking tokens, payment amounts, other SMS/
push content) just by knowing or guessing a Mongo id. It's currently
unused by the frontend (the live notification feed users actually see
comes from the `'notification:feed'` Socket.IO broadcast, not this REST
route), so this was a live but silent gap rather than something already
visibly broken. Fixed with the same `requireAuth` + ownership `canAct()`
pattern used elsewhere; `/feed` (the unscoped demo-wide panel) is
deliberately left public, as before.

Verified with `node --check`, a standalone `require()` of both edited
files plus the full `server.js`, and a real (timed) server start with no
DB configured - same result as before, listens immediately and degrades
gracefully. No frontend changes this round.

Files touched: `backend/controllers/notificationController.js`,
`backend/routes/notificationRoutes.js`.

## Latest session, part 3 - Queue-tracking gap fixes + ownership/authorization hardening

Verified with `node --check` on every edited backend file, a standalone
`require()` of every modified/dependent backend module (no syntax or
require-time errors), a real `server.js` start with no DB configured
(still listens immediately and degrades gracefully, unchanged from
before), and a full `npm run build` of the frontend (clean, no errors).
No live MongoDB or Socket.IO integration testing was possible in this
sandbox (same limitation as every prior session) - test the flows below
live after deploying.

This session was a deep audit of the queue-tracking system's backend
logic and real-time wiring specifically, prompted by a walkthrough of
how it works end-to-end. Six real gaps and two security bugs turned up;
all are fixed below.

**Booking cancellation didn't actually exist.** `queueStatus` has always
had a `'cancelled'` enum value, and `computeQueueInfo` even had a branch
for it, but no route or button anywhere ever set a booking to that state.
Added `DELETE /api/bookings/:id/cancel` (farmer-only, ownership-checked,
only while still `waiting` + `booked` - same window as reschedule),
wrapped in a transaction so it frees the slot's `bookedCount` at the same
time (unlike mark-absent, previously - see below). Added a "Cancel
booking" action to `TrackBooking.jsx`.

**Marking a farmer absent didn't free their slot.** `markAbsent` only
ever flipped `queueStatus` to `'absent'` - the slot's `bookedCount` was
never decremented, so a no-show's seat stayed occupied for the rest of
the day even though nobody would actually use it. Now wrapped in a
transaction that releases the seat the same way a real cancellation does.

**"Farmers ahead of you" used booking time, not check-in time.**
`computeQueueInfo` used to rank the queue by `createdAt` (when the slot
was originally booked). But the officer's "Call Next" button only ever
calls a `checked_in` + `waiting` booking - so an earlier-booked-but-
later-arrived farmer could show as "ahead" of someone who'd been
physically checked in first. Rewritten to rank by `checkedInAt` among
checked-in bookings, and to treat a not-yet-checked-in booking as behind
everyone who already is (it also now returns an `awaitingCheckIn: true`
flag for that case, unused by the UI yet but available).

**`queue:update` was emitted into a void.** `call-next` has always
emitted this Socket.IO event to the centre's room, and officers do join
that room - but nothing on the frontend ever listened for it. A second
officer or an admin with the same centre's dashboard open in another tab
would never see the queue move without a manual reload. Now:
  - `check-in` and `mark-absent` also emit `queue:update` (previously
    only `call-next` did), and cancellation emits it too.
  - `OfficerDashboard.jsx` subscribes to it and refetches the queue live.
  - Fixed the reason it would have silently failed even after
    subscribing: `SocketContext.jsx` used to only join the farmer/centre
    room at the exact moment of the login API call succeeding
    (`Login.jsx`). Since the session itself is restored from
    `localStorage` on every page load without re-running that login
    code, a plain page refresh left the socket connected but in *no
    room at all*. Rooms are now (re)joined automatically off the
    persisted session on every connect/reconnect, so a refresh or a
    dropped connection both recover correctly.

**Two authorization bugs**: `requireAuth(['farmer'])` /
`requireAuth(['officer', 'admin'])` only ever checked that the caller
*was* a farmer/officer, never that they owned the specific record they
were acting on.
  - Any signed-in farmer could reschedule (and, before this session,
    would have been able to cancel) any other farmer's booking just by
    knowing its id. Fixed: `rescheduleBooking` and the new
    `cancelBooking` now check `booking.farmer === req.user.id`.
  - Any officer could check-in / call-next / mark-absent / advance a
    procurement stage / record a quantity / update a payment status for
    a booking at a **different centre**, or view another centre's queue,
    just by changing the id/centreId in the request. Added a shared
    `assertOfficerOwnsCentre(req, centreId)` guard (`middleware/auth.js`)
    and applied it in `queueController`, `procurementController`, and
    `paymentController`. Admins remain intentionally
    centre-unrestricted.

**No DB-level guarantee against duplicate daily queue numbers.** The
transaction-based `countDocuments`-then-create pattern already prevents
this in practice, but nothing stopped a future code path (a script, a
migration) from bypassing it. Added a partial unique compound index on
`Booking`: `{ centre, date, dailyQueueNumber }`. `createBooking` and
`rescheduleBooking` now also catch a resulting duplicate-key error and
return a friendly, retryable 409 instead of a raw 500.

Files touched: `backend/models/Booking.js`,
`backend/controllers/{bookingController,queueController,
procurementController,paymentController}.js`,
`backend/middleware/auth.js`, `backend/routes/bookingRoutes.js`,
`frontend/src/context/SocketContext.jsx`,
`frontend/src/pages/officer/Dashboard.jsx`,
`frontend/src/pages/farmer/TrackBooking.jsx`,
`frontend/src/locales/en.json`.

## Latest session, part 2 - Maps, complaint photos, Home/About rebuild, animations

Verified with a full `npm run build` after every batch of changes (252
modules, builds clean throughout). All three hotlinked photo URLs
confirmed to resolve to real images (Pexels, free-to-use license, no
attribution required) via direct fetch before being wired in - see the
list below for exact URLs/credits.

**Bug fix**: the Landing hero's "HarvQ" heading was invisible - a
base-layer rule (`h1,h2,h3,h4 { text-ink }` in `styles/index.css`) was
winning over the hero wrapper's `text-white` because a rule that directly
targets an element always beats an inherited value, regardless of which
CSS layer it's in. Fixed by putting `text-white` directly on the `<h1>`
itself. Worth remembering for any future heading placed on a dark/colored
background - the ambient `text-ink` default will silently win unless the
heading itself gets an explicit color class.

**Maps everywhere a centre is shown**: `utils/centreMap.js` builds a
keyless `google.com/maps/search` URL from a centre's stored
`location.latitude/longitude` (falls back to a text search by
name/village/taluk/district if coordinates are missing). Wired into
`CentreSchedules.jsx`, `CentreMultiSelect.jsx`'s search results,
`BookSlot.jsx` (recommended centre, alternatives, and the final confirm
step), and `TrackBooking.jsx` (right after booking, as requested). No
Google Maps API key exists anywhere in this project, so this uses the
public no-key URL scheme rather than an embedded iframe - swapping to a
real embedded map later is straightforward if you get a Maps API key.

**Complaint photos**: the complaint history/status list on
`ReportComplaint.jsx` was **already fully built** on both ends (backend
`GET /complaints/farmer/:farmerId` already existed) - nothing was missing
there. What was added: a "Take a photo" button using
`capture="environment"` (opens the phone's camera directly), shown only
when no file is attached yet.

**Home + About rebuild**: `Landing.jsx` now has the fuller CROPSYNC-style
structure - hero, a real-photo banner, quick-services grid, a "How
HarvQ Works" 5-step flow, "Why HarvQ" reasons list, and a "Need
Help" section. New `About.jsx` page (`/about`, linked from the nav and
footer) adapted from CROPSYNC's About sections but rewritten to actually
describe HarvQ - CROPSYNC's own copy repeatedly frames itself as a
"platform concept," which isn't appropriate for something presented as a
live government service, so that framing was dropped rather than
translated literally. "Need Help" was also added to the farmer Login
page. All of CROPSYNC's own Help/FAQ/Contact/Services links point to
"coming soon" placeholder stubs with no real content in the source, so
HarvQ's Need Help section links to real destinations instead (the
About page, Centre Schedules, and the helpline number) rather than
inventing FAQ content that can't be verified.

**Real photos** (Pexels, free-to-use, no attribution legally required,
credited here anyway):
- Home page banner: farmer in a rice field, Tenkasi, Tamil Nadu - Rohit
  Sharma associate/community photo, pexels.com/photo/36436061
- About page intro: golden rice field in sunlight - Quang Nguyen Vinh,
  pexels.com/photo/6129010
- About page harvest band: farmer working in a rice paddy - Amar .M,
  pexels.com/photo/14882028

**Animation polish**: buttons now have `active:scale-95` press feedback;
`.field-input` has a smoother focus transition; added a `shake` keyframe/
animation, wired into the error message on every login-style form
(farmer/staff/officer login, registration). Respects the existing
`prefers-reduced-motion` override already in the base layer.

## Latest session, part 1 - HarvQ visual redesign + Bhashini retry fix

Verified with: `node --check` on both touched backend files (syntax-only -
no Bhashini credentials available in this sandbox to exercise the actual
retry path live) and a full `npm run build` in `frontend/` after every
batch of page edits (250 modules, builds clean throughout). No live
MongoDB/Bhashini credentials available - **test the retry logic and the
restyled pages live after deploying**.

**Frontend redesign** - re-themed to the "CROPSYNC" design reference
supplied this session, keeping the "HarvQ" name and every existing
page/field/route as-is:
- `tailwind.config.js` + `src/styles/index.css`: swapped the color tokens
  (`primary`/`accent`/`ink`/`muted`/`border`/`paper`/`surface`/`danger`/
  `success`) and border-radius scale to the new palette, and reshaped the
  shared `.btn*`/`.card`/`.field-input`/`.badge` component classes to match
  the reference's bolder pill buttons and soft tinted card shadows. Because
  the app already used these semantic tokens/classes everywhere (verified
  via grep - no stray hardcoded hex colors outside these two files plus one
  intentional one in Footer.jsx), this alone re-themes every page.
- Removed the old `GovHeader.jsx` (GIGW identity-strip placeholder with a
  department-name stand-in) per this session's direction to drop it
  entirely. Its one real feature - the language switcher - was **not**
  dropped, just moved into a new `UtilityBar.jsx` that mirrors the
  reference's thin utility-bar pattern.
- `Navbar.jsx`: new logo + brand lockup, underline-on-hover/active nav
  links (now using `NavLink`), login rendered as a distinct pill button -
  same links, same auth/role logic as before.
- `Footer.jsx`: restyled (tinted background, bolder brand mark) but all
  GIGW-required text content (department, contact, content-owner,
  last-updated, accessibility note) left untouched - only the identity
  *strip* was in scope to remove, not the footer's compliance content.
- Logo/favicon: copied the reference's agriculture-logo SVG into
  `src/assets/harvq-logo.svg` and `public/favicon.svg` (this project
  had no `public/` folder or favicon before). Brand text stays
  "HarvQ" everywhere, not the reference project's own name.
- Page-level passes (beyond the automatic re-theme above): `Landing.jsx`
  (gradient hero band, icon-circle feature cards), `farmer/Home.jsx`
  (icon-circle portal links), `farmer/Login.jsx`, `StaffLogin.jsx`,
  `officer/Login.jsx` (all three now share one centered auth-card layout
  with a gradient backdrop), and `farmer/Register.jsx` (gradient page
  backdrop only - the 589-line multi-step form logic itself was
  deliberately left untouched given its size/importance).
- **Not yet given a bespoke layout pass**: `farmer/BookSlot.jsx`,
  `TrackBooking.jsx`, `PaymentStatus.jsx`, `Profile.jsx`,
  `ReportComplaint.jsx`, `CentreSchedules.jsx`, `IVRSimulator.jsx`,
  `officer/Dashboard.jsx`, `admin/Dashboard.jsx`. These already inherit the
  full new color/button/card/input/badge system automatically (confirmed,
  no stray old-theme hex values in any of them), so they're visually
  consistent with the rest of the app already - they just haven't had the
  same hands-on layout polish (icon circles, gradient bands, etc.) as the
  pages listed above. Worth a follow-up pass if you want full parity.

**Bhashini translation retry fix** - `backend/utils/bhashiniClient.js`'s
`translateBatchRaw` now retries a failed inference call up to 3 total
attempts (3s, then 8s backoff) before throwing, instead of failing
immediately. This directly targets the observed pattern where the very
first `npm run generate:translations` after the pipeline's been idle times
out for every language (cold start) and only succeeds on a manual second
run - now that retry happens automatically within one run. The one
language that failed identically both times with `DHRUVA-101: Failed to
send request` (not a timeout) will still exhaust all 3 attempts and throw
if that's a persistent problem on Bhashini's side rather than a cold
start - `generateTranslations.js`'s existing per-language meta-tracking
already handles that correctly (leaves that language's output/meta
untouched so it's retried on the next run, doesn't block the other 21).
Re-run `npm run test:bhashini` isolated to that one language if it still
fails after this to confirm whether it's a payload-size limit or a genuine
outage on that specific model.

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
- **Fixed a real caching bug in `generate:translations`** that made it
  quit at "0/29 translated" for every language even with working keys:
  the script wrote a `.en.snapshot.json` cache file unconditionally, even
  during a no-keys placeholder run (which copies English text into every
  locale file so the app still builds). The next run then compared the
  placeholder English text already sitting in `ta.json`/etc. against that
  snapshot, found no difference, and concluded 0 keys needed translating.
  The snapshot is now only written after a run that actually had working
  keys - deleting `.en.snapshot.json` by hand (the workaround used once)
  is no longer necessary going forward.
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

## Session 3 (translation root-cause fix, complaint attachments, full site-wide i18n migration)

Verified with: `node --check` + a standalone `require()` of every touched
backend module (all load cleanly), a full `npm run build` in `frontend/`
(249 modules, clean, no errors), and an end-to-end run of
`generate:translations` in both unconfigured (placeholder) mode and with a
deliberately-invalid key (to confirm the new per-language failure handling
reports the real HTTP status and writes nothing on failure). No live
MongoDB or real Bhashini key was available in this sandbox - **test the
complaint attachment upload and a real `generate:translations` run against
your live setup**.

- **Found the real root cause of "0/29 translated" persisting even with an
  approved key**: `bhashiniClient.js`'s `translateBatch` silently swallowed
  *any* failure from the actual translate/compute call (as opposed to the
  Pipeline Config call, which `test:bhashini` checks and which can succeed
  even when the compute call itself fails) and returned the original
  English text unchanged. `generateTranslations.js` then wrote that
  unchanged text into every locale file and - regardless of whether
  anything had actually been translated - snapshotted current English as
  "handled" the moment `BHASHINI_USER_ID`/`BHASHINI_API_KEY` were merely
  *present*. A single failed call, once, got permanently cached as success.
- **Fixed properly, in two parts**:
  1. Added `translateBatchRaw` (exported from `bhashiniClient.js`), which
     throws instead of swallowing errors, with the real HTTP status and
     response body from Bhashini in the message. `translateBatch` (used by
     the IVR simulator, which needs to always get something back to speak)
     keeps its old silent-fallback behaviour unchanged.
  2. Rewrote `generateTranslations.js` to track success **per language**
     via a small `frontend/src/locales/.meta/<lang>.json` file recording
     which English source text was last *successfully* translated for
     that language, replacing the single shared `.en.snapshot.json` (now
     deleted). A failure for one language can no longer mask or be masked
     by another language's success, and a failed language's keys are
     retried on the next run instead of being silently marked done. Run
     `npm run generate:translations` again after this fix - if it's still
     failing, the console will now show the real reason (HTTP status +
     response body) instead of a misleading `0/29`.
- **Complaint attachments**: farmers must now attach 1-3 supporting
  documents/photos (PDF/JPEG/PNG, 5MB each) when filing a complaint -
  `Complaint` model, `middleware/upload.js` (new
  `handleComplaintAttachmentsUpload`, stored under
  `backend/uploads/complaint-attachments/` - same ephemeral-disk caveat as
  lease documents), `complaintController.js`, and `complaintRoutes.js` all
  updated. `ReportComplaint.jsx` has the file picker + validation, and both
  it and the admin Complaints tab show attachment links.
- **Full site-wide i18n migration completed**: every page and shared
  component now uses `t('key')` - previously only the Navbar and homepage
  hero did, so every other page rendered in English regardless of the
  selected language. `en.json` grew from 29 keys to 497. `LanguageContext`'s
  `t()` also gained optional `{param}` interpolation
  (`t('key', { start, end })`) for the handful of strings that need a
  dynamic value inside a sentence (e.g. the reschedule-suggestion message)
  - worth spot-checking those specific strings after a real
    `generate:translations` run, since machine translation doesn't always
    leave `{curly}` placeholders untouched.
- **Known gap, not fixed this session**: `IVRSimulator.jsx`'s on-screen UI
  text is now translated, but a handful of *spoken* status-check lines
  (`checkTokenStatus`, `checkProcurementStatus`, `checkPaymentStatus`, and
  the token read-out in `confirmBooking`) are still hardcoded English
  sentences passed straight to `speakText`, so a caller who selected Tamil/
  Hindi/Telugu will still hear these specific lines in English. Fixing this
  properly needs new entries in the IVR's own hand-verified en/ta/hi/te
  prompt set (`ivrController.js`), not the 22-language site dictionary -
  flagging it rather than guessing at the phrasing.
