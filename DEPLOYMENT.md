# Deployment Guide — Kalanjiyam Procurement Queue System

This walks through taking the project from your machine to a live URL you can
hand to judges: **MongoDB Atlas** (database) → **Render** (backend API +
Socket.IO) → **Vercel** (frontend). Follow the sections in order — each one
depends on something from the previous step.

Budget about 45–60 minutes the first time through.

---

## 0. Prerequisites

- A GitHub account (all three platforms deploy from a Git repo)
- Node.js installed locally (only needed to run the seed script once against
  your live database — you already have this since you built the project here)
- Free accounts on: [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register),
  [Render](https://render.com), [Vercel](https://vercel.com) — GitHub sign-in
  works for all three and is the fastest path

---

## 1. Push the code to GitHub

```bash
cd procurement-system
git init
git add .
git commit -m "Initial commit - SIH 26032 procurement queue system"
```

Create a new **empty** repository on GitHub (no README/license, so there's no
merge conflict), then:

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

The `backend/` and `frontend/` `.gitignore` files already exclude
`node_modules/` and `.env`, so secrets won't be pushed.

---

## 2. MongoDB Atlas — create the database

1. Sign in to Atlas → **Build a Database** → choose the **M0 Free** tier →
   pick any region close to India (e.g. Mumbai, `ap-south-1`) → **Create**.
2. **Database user**: when prompted, create a username/password (autogenerate
   the password and save it somewhere safe — you'll need it in step 3).
3. **Network access**: add `0.0.0.0/0` ("Allow access from anywhere"). This is
   what makes Render able to reach it. For a real government deployment later
   you'd restrict this to Render's static IPs, but for a hackathon prototype
   this is the standard approach.
4. Once the cluster is up, click **Connect → Drivers**, copy the connection
   string. It looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. Edit it to include your database name before the `?`:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/procurement_queue?retryWrites=true&w=majority
   ```
   Save this full string — it's your `MONGODB_URI`.

---

## 3. Render — deploy the backend

1. Render dashboard → **New → Web Service** → connect your GitHub repo.
2. Configure:
   - **Name**: `procurement-queue-backend` (or anything)
   - **Root directory**: `backend`
   - **Runtime**: Node
   - **Build command**: `npm install`
   - **Start command**: `npm start`
   - **Instance type**: Free
3. **Environment variables** (Render dashboard → Environment tab) — add each
   one from `backend/.env.example`:
   | Key | Value |
   |---|---|
   | `MONGODB_URI` | the Atlas connection string from step 2 |
   | `JWT_SECRET` | any long random string (e.g. generate with `openssl rand -hex 32`) |
   | `JWT_EXPIRES_IN` | `7d` |
   | `CORS_ORIGIN` | leave as `*` for now — you'll tighten this in step 5 |
   | `SIMULATE_OTP` | `true` |
   | `SIMULATE_NOTIFICATIONS` | `true` |
   | `DEFAULT_OFFICER_PASSWORD` | the starting password given to any centre that doesn't have one yet - reset individual centres' passwords from the admin panel afterwards |
   | `GOOGLE_TRANSLATE_API_KEY` | optional - enables live translation of IVR prompts into languages beyond EN/TA/HI/TE |

   Do **not** set `PORT` — Render sets this automatically and your `server.js`
   already reads `process.env.PORT`.
4. Click **Create Web Service**. First deploy takes a few minutes. When it's
   live, Render gives you a URL like `https://procurement-queue-backend.onrender.com`.
5. Verify it: open `https://<your-backend>.onrender.com/health` in a browser —
   you should see `{"status":"ok","service":"procurement-queue-backend"}`.

---

## 4. Seed the live database

Run this **from your own machine**, pointed at the Atlas database (Render's
free tier doesn't give you a shell to run it remotely):

```bash
cd backend
cp .env.example .env
# edit .env and paste your real MONGODB_URI
npm install
npm run seed
```

This creates the 3 demo centres, crop rates, and the demo officer/admin/farmer
logins listed in the seed script output. Re-run it any time you want to reset
demo data (it wipes and recreates those collections).

---

## 5. Vercel — deploy the frontend

1. Vercel dashboard → **Add New → Project** → import the same GitHub repo.
2. Configure:
   - **Root directory**: `frontend`
   - **Framework preset**: Vite (Vercel usually auto-detects this)
   - **Build command**: `npm run build` (default)
   - **Output directory**: `dist` (default)
3. **Environment variable**:
   | Key | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://<your-backend>.onrender.com/api` |
4. Click **Deploy**. You'll get a URL like `https://kalanjiyam.vercel.app`.

---

## 6. Lock down CORS

Now that you have your real Vercel URL, go back to Render → your backend
service → Environment → update:

| Key | Value |
|---|---|
| `CORS_ORIGIN` | `https://kalanjiyam.vercel.app` (your actual Vercel URL, no trailing slash) |

Saving this triggers an automatic redeploy. This closes the API back down so
only your frontend can call it — leaving it on `*` works for a demo but isn't
something to ship even as a prototype if it's going in front of judges as a
"real" system.

---

## 7. The Render free-tier idle problem — and the keep-alive ping

**What's happening:** Render's free web services spin down after ~15 minutes
of no incoming traffic, and the next request pays a 30–50 second cold-start
penalty while it spins back up. If a judge opens your link cold, the first
load will hang and look broken.

**My honest take on the ping-bot fix:** it's the right call for keeping a
*demo* responsive, but it's a workaround for a free-tier limitation, not a
production fix — worth knowing the difference so you don't carry it forward
into an actual deployment:

- It works because the spin-down timer resets on *any* request — so a ping
  every 5–10 minutes (comfortably under Render's ~15 minute threshold) keeps
  the instance warm indefinitely.
- Render's free tier gives 750 instance-hours/month. Keeping one service
  always-on uses ~744 hours in a 31-day month, so you're fine running exactly
  one free service this way — just don't add a second free service that also
  needs to stay warm, or you'll exceed the cap.
- It does **not** need to touch MongoDB Atlas — the M0 free cluster doesn't
  idle/spin down, only the Render web service does. Ping the backend only.
- For the actual SIH submission/judging round, this is a reasonable,
  transparent mitigation. If this ever becomes a real deployment serving
  actual farmers, the honest fix is a paid Render instance (or equivalent) —
  a government procurement service can't be depending on a ping bot to stay up.

**Setup (using [cron-job.org](https://cron-job.org), free, no card required):**

1. Create a free account.
2. **Create cronjob** →
   - **URL**: `https://<your-backend>.onrender.com/health`
   - **Schedule**: every 10 minutes
   - **Request method**: GET
3. Save and enable it. That's it — no code changes needed, since `/health`
   already exists in `server.js` and does no database work, so the ping itself
   costs nothing meaningful even while the DB might be reconnecting.

(UptimeRobot is an equally good free alternative — its free plan pings every
5 minutes and also gives you uptime alerts by email, which is a nice bonus if
you want to know if the service goes down before a judge does.)

---

## 8. Post-deployment checklist

Run through each of these on the **live** Vercel URL, not localhost:

- [ ] `/` loads and shows the role cards
- [ ] Farmer → Register a new farmer (name, mobile, gender, DOB) → note the
      dev OTP shown on screen → log in with it → complete location, Aadhar
      (its own page + mock OTP), Patta/Chitta (its own page) + policy, and
      preferred centres (recommended ones pre-selected) → lands on the
      farmer home page with Slot Booking / History / Payments / Report links
- [ ] Farmer → Book a slot → pick a date (or a custom one further out) →
      pick a crop from the list → confirm the recommended centre/slot is
      highlighted → complete a booking with bank details → token page shows
      queue position and a QR gate pass
- [ ] Notification simulator panel (bottom-right) shows the booking-confirmed
      SMS/WhatsApp messages appearing live
- [ ] Procurement centre login (`/officer/login`) → pick any real centre from
      the search list → if you don't know its password, log into the admin
      panel and reset it from the Centres tab first → see today's queue for
      that centre → check in the farmer you just booked → call next →
      advance through weighing/quality/procurement → record quantity → process
      and complete payment
- [ ] Centre settings tab → adjust slot timings/queue limit within the bounds
      shown, change the centre's own password → save
- [ ] Farmer's token page (open in another tab/device) reflects each stage
      change within ~10 seconds (it polls) without a manual refresh
- [ ] Admin login with `admin` / `admin123` → change the password immediately
      from the Staff tab → Overview tab shows all centres with live stats,
      filter by district → Centres tab: add a centre (note the one-time
      starting password shown), edit an existing one's policy limits → Crop
      rates tab: add a crop with its unit (e.g. bag) and rate → Complaints
      tab: file a test complaint as a farmer, confirm it shows up here and
      can be marked resolved
- [ ] Centre schedules page (`/centres/schedules`) → logged out, shows a
      filterable list; logged in as the farmer, shows their own centres first
- [ ] IVR demo → call in with the seeded farmer's number (`9876543210`) →
      step through language select → book a slot → hear/see the token read out
- [ ] Reload the Vercel URL after ~20 minutes of inactivity (or just trust the
      keep-alive ping) to confirm there's no cold-start delay during judging

---

## 9. What changes for a real (non-hackathon) rollout

Worth having ready if asked in judging: this architecture is deliberately
built so each of these swaps is additive, not a rewrite —

- `backend/utils/otpSimulator.js` → call a real SMS provider (e.g. MSG91,
  Twilio) instead of returning `devCode`
- `backend/utils/notificationSimulator.js` → send via real SMS/WhatsApp
  Business API providers in addition to (or instead of) `Notification.create`
- A real IVR/telephony provider (e.g. Exotel, Knowlarity) replaces the browser
  keypad — it would call the *same* `/api/bookings`, `/api/centres`,
  `/api/slots` endpoints the web app and simulator already use
- Render free tier → a paid instance (removes idling, no ping bot needed)
- Atlas M0 → a paid tier once real farmer data and load are involved, plus
  tightening network access from `0.0.0.0/0` to specific IPs
