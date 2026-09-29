# Running HarvQ locally for a demo (no Vercel, no Render)

`DEPLOYMENT.md` covers the real hosted setup (Vercel + Render + Atlas).
This is the alternative for presenting live at a hackathon: everything
runs on your own laptop, on your own venue wifi, with nothing depending
on Render's free-tier cold starts or Vercel build times. **MongoDB Atlas
is still used as the database** - that part stays online/cloud, since
there's no good offline substitute and Atlas's free tier is more than
enough for a demo.

This only needs to be done once before the event. On the day, it's just
one command.

> **Only want the frontend on your laptop (address bar shows
> `localhost`) while the backend stays on Render?** Skip to
> [Frontend on localhost, backend on Render](#frontend-on-localhost-backend-on-render)
> - that mode needs no local backend, no `backend/.env`, and no Atlas
> setup on your machine.

## 1. One-time setup

### 1a. Get a MongoDB Atlas connection string
If you already have one from following `DEPLOYMENT.md`, skip to 1b and
reuse it.

Otherwise: create a free cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) →
Database Access, add a user with a password → Network Access, add
`0.0.0.0/0` (venue wifi's IP is unpredictable, so allow from anywhere -
fine for a demo database with no real farmer data in it) → Database →
Connect → Drivers, copy the `mongodb+srv://...` connection string.

### 1b. Configure the backend
```bash
cd backend
cp .env.example .env
```
Open `backend/.env` and set at minimum:
- `MONGODB_URI` - the Atlas connection string from step 1a (fill in the
  real username/password, and add a database name after the last `/`,
  e.g. `.../harvq_demo`)
- `JWT_SECRET` - any long random string
- Leave everything else at its default - `CORS_ORIGIN=http://localhost:5173`
  already matches the frontend's local dev port, and the Bhashini/OTP
  simulation toggles don't need touching for a demo.

### 1c. Install everything
From the **project root** (not backend/ or frontend/):
```bash
npm run install:all
```
This installs the root's own tiny toolset (just `concurrently`, used to
start both servers together) plus `backend/` and `frontend/`'s own
dependencies.

### 1d. Seed baseline data
```bash
npm run seed
```
This is non-destructive (upserts crop rates, ensures at least the demo
centres exist) - safe to re-run any time, including right before you go
on stage if you want a clean slate for demo accounts. If you want the
*real* ~874 Tamil Nadu DPC centres instead of the 3 fake demo ones, run
`cd backend && npm run seed:dpc` once as well (this hits an external
government site, so do it in advance, not on venue wifi minutes before
you present).

## 2. On demo day
From the project root:
```bash
npm run dev
```
This starts both servers together in one terminal (color-coded
`[backend]` / `[frontend]` prefixes):
- Backend API on **http://localhost:5000**
- Frontend on **http://localhost:5173** - open this one in your browser

Ctrl+C once stops both. No build step needed - `frontend`'s dev server
(Vite) serves the app directly with instant hot-reload if you need to
tweak anything between runs.

## Frontend on localhost, backend on Render

Use this when you're happy for the backend to keep running on Render but
want the browser to show `http://localhost:5173` instead of a
`vercel.app` address. The backend keeps using its own MongoDB Atlas
connection (already configured in Render's environment), so **nothing
backend-related is needed on your laptop** - no `backend/.env`, no local
Atlas setup.

### One-time setup

**1. Deploy the latest backend code to Render.** This project's
`server.js` now accepts several allowed origins in `CORS_ORIGIN`
(previously it accepted exactly one, so Render couldn't allow both your
Vercel site and `localhost` at once). Push/redeploy so Render is running it.

**2. Allow `localhost` in Render's CORS setting.** Render dashboard →
your backend service → **Environment** → set:
```
CORS_ORIGIN=https://your-site.vercel.app,http://localhost:5173
```
(comma-separated, and keep your real Vercel URL in there so the deployed
site keeps working). Saving makes Render restart the service by itself.
The origin must be exactly `http://localhost:5173` - `127.0.0.1`, your
LAN IP, or a different port will be blocked. *Shortcut if you'd rather
not touch code or the list:* delete `CORS_ORIGIN` on Render entirely and
it allows any origin.

**3. Point the local frontend at Render.**
```bash
cd frontend
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
```
Then edit `frontend/.env` so it contains (your real Render URL, keeping
`/api` on the end and no trailing slash):
```
VITE_API_BASE_URL=https://your-app-name.onrender.com/api
```
Socket.IO (live queue updates and notifications) derives its address from
this same value, so nothing else needs configuring.

**4. Install once** (from the project root): `npm run install:all`

### On demo day
```bash
npm run dev:frontend
```
Then open **http://localhost:5173**. Use `dev:frontend`, not `dev` -
`dev` also starts a local backend on port 5000, which you don't want here.

**Wake Render up first.** Free-tier Render services sleep after about 15
minutes without traffic, and the first request afterwards can take 30-60
seconds - which on stage looks like a broken login. A few minutes before
you present, open `https://your-app-name.onrender.com/health` in a browser
tab and wait for `{"status":"ok",...}`, then hit it again just before you
start.

**What the audience sees:** `localhost:5173` in the address bar. The API
calls still go to Render, and would show up as `onrender.com` requests
if someone opened the browser's Network tab.

### If it doesn't work
- **CORS error in the browser console** - Render's `CORS_ORIGIN` doesn't
  include `http://localhost:5173` exactly, the change wasn't saved, or
  Render is still running the old `server.js` (only understands one origin
  - redeploy it).
- **"Network Error" / everything spins on first load** - Render was
  asleep; give it up to a minute and retry (see waking it up above).
- **"Port 5173 is already in use"** when starting the frontend - close
  whatever holds the port (usually another `npm run dev`). The frontend is
  deliberately locked to 5173 rather than hopping to 5174, because Render
  only allows 5173.
- **Still hitting `localhost:5000`** (requests failing with connection
  refused) - `frontend/.env` is missing or misnamed (it must be `.env`,
  not `.env.example`), or you didn't restart `npm run dev:frontend` after
  editing it; Vite only reads it at startup.

## Troubleshooting
- **"Failed to connect to MongoDB"** in the backend's log on startup -
  the app still starts (so the frontend loads and you can show the
  Notification Simulator's UI, etc.) but every real data-backed route
  will error. Double check `MONGODB_URI` in `backend/.env` - a
  copy-paste with the angle brackets (`<user>`, `<password>`) still in
  it is the most common cause of a URI-parsing failure.
- **`querySrv ECONNREFUSED` / `querySrv EBADNAME`** specifically (as
  opposed to a timeout) - this is a DNS problem, not an Atlas problem:
  your network's DNS resolver is refusing or failing the special `SRV`
  record lookup that `mongodb+srv://` connection strings depend on,
  before your app ever reaches Atlas's servers. Very common on
  campus/office wifi and some ISPs/routers that filter uncommon DNS
  record types. In order of most-likely-to-work:
  1. Change your machine's DNS to `8.8.8.8` / `8.8.4.4` (Google) or
     `1.1.1.1` (Cloudflare) - Windows: *Settings → Network & Internet →
     your network → Edit DNS settings → Manual*. A phone hotspot is a
     quick way to confirm the network is the cause if this doesn't help.
  2. Use the non-SRV connection string instead (Atlas dashboard →
     cluster → Connect → Drivers - if only the `+srv` form is shown, ask
     Atlas's own docs/support chat for the "standard connection string"
     for your cluster). It lists each shard host with its port directly
     (`mongodb://user:pass@shard-00-00.xxxxx.mongodb.net:27017,...`) and
     skips the SRV lookup entirely.
  3. Confirm Network Access in Atlas has `0.0.0.0/0` (or your current
     IP) - unrelated to this specific DNS error, but the next thing
     that'll block you once DNS resolves.
- **CORS errors in the browser console** - only happens if you changed
  the frontend's port (e.g. `vite --port 3000`) without also updating
  `CORS_ORIGIN` in `backend/.env` to match.
- **Port already in use** - something else on your laptop is already on
  5000 or 5173. Either close it, or set `PORT=...` in `backend/.env`
  and/or run the frontend with `npm run dev --prefix frontend -- --port 3000`
  (update `CORS_ORIGIN` to match if you do).
- **"Terminate batch job (Y/N)?" after Ctrl+C, then `concurrently`
  reports both processes "exited with code 1"** - normal Windows
  `cmd`/nodemon behaviour, not a crash. Type `Y` and press Enter to
  actually stop it.

## Advanced: one process, one port (optional)

If you'd rather not have two dev servers running (e.g. presenting over a
flaky projector connection where switching windows/terminals is
annoying), you can build the frontend once and have the backend serve it
directly, so only port 5000 is used for everything:

```bash
npm run build:offline
npm run start:offline
```

Then open **http://localhost:5000** - both the API and the built
frontend are served from that single port. Re-run `npm run build:offline`
any time you change frontend code (this mode doesn't hot-reload). These
two scripts wrap the underlying `SERVE_FRONTEND=true` env var via
`cross-env`, so they work as-is on Windows (PowerShell/cmd), Mac, and
Linux - setting that variable directly (`SERVE_FRONTEND=true npm start`)
only works in a Unix-style shell and will error in PowerShell/cmd with
"is not recognized as the name of a cmdlet...". This is opt-in
specifically so it has zero effect on the real Render deployment, which
doesn't set that variable.

## About the npm warnings you'll see

`npm run install:all` will print a handful of things that look alarming
but are safe to ignore for a demo:
- **"X vulnerabilities (moderate/high)"** - from `npm audit`, in
  transitive dev/build dependencies (Vite's toolchain, mainly). Don't run
  `npm audit fix --force` right before presenting - it can bump major
  versions and break the build with no time left to fix it. These are
  fine to leave alone for a demo; revisit later if this ever goes to
  production.
- **"install scripts blocked ... esbuild@... postinstall"** - a newer npm
  security default blocking a build tool's post-install script. Vite
  ships prebuilt binaries as optional dependencies precisely so it still
  works without that script running, which is exactly what you'll see -
  the build succeeds despite the warning.
