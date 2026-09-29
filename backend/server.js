require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { UPLOAD_ROOT } = require('./middleware/upload');

const connectDB = require('./config/db');
const registerSocketHandlers = require('./sockets/queueSocket');

const authRoutes = require('./routes/authRoutes');
const centreRoutes = require('./routes/centreRoutes');
const slotRoutes = require('./routes/slotRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const queueRoutes = require('./routes/queueRoutes');
const procurementRoutes = require('./routes/procurementRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const ivrRoutes = require('./routes/ivrRoutes');
const adminRoutes = require('./routes/adminRoutes');
const geoRoutes = require('./routes/geoRoutes');
const farmerRoutes = require('./routes/farmerRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const { ensureCentreDefaults } = require('./utils/ensureCentreDefaults');
const { loadDpcCentres } = require('./utils/loadDpcCentres');
const { ensureCropRateDefaults } = require('./utils/ensureCropRateDefaults');

const app = express();
const server = http.createServer(app);

// CORS_ORIGIN accepts one origin or a comma-separated list, e.g.
//   CORS_ORIGIN=https://harvq.vercel.app,http://localhost:5173
// so the same Render backend can serve the deployed Vercel frontend AND a
// frontend running on someone's laptop (a local demo pointed at Render).
// Unset (or empty) still means "allow any origin", as before. Trailing
// slashes are stripped since browsers never send one in the Origin header
// and a stray one in the env var would silently never match.
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);
const corsOrigin = allowedOrigins.length ? allowedOrigins : '*';

const io = new Server(server, {
  cors: { origin: corsOrigin },
});

app.set('io', io);
registerSocketHandlers(io);

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'procurement-queue-backend' }));
// See middleware/upload.js's note on persistence before relying on this in production.
app.use('/uploads', express.static(UPLOAD_ROOT));

app.use('/api/auth', authRoutes);
app.use('/api/centres', centreRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/procurement', procurementRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ivr', ivrRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/geo', geoRoutes);
app.use('/api/farmers', farmerRoutes);
app.use('/api/complaints', complaintRoutes);

// Optional single-port local-demo mode: serve the frontend's already-built
// static files straight from this same Express server, so a hackathon demo
// only needs one process/port (see LOCAL_DEMO.md's "Advanced" section)
// instead of running the Vite dev server separately. Opt-in via
// SERVE_FRONTEND specifically so this has zero effect on the real Render
// deployment, which serves the API only and doesn't set that variable -
// the frontend is deployed separately to Vercel there.
if (process.env.SERVE_FRONTEND === 'true') {
  const frontendDist = path.join(__dirname, '../frontend/dist');
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    // SPA fallback: any GET that isn't an API/health/uploads route (already
    // handled above) falls through to index.html so client-side routing
    // (react-router) still works on a hard refresh of e.g. /farmer/login.
    app.get('*', (req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  } else {
    console.warn(`[server] SERVE_FRONTEND=true but ${frontendDist} doesn't exist - run "npm run build" in frontend/ first.`);
  }
}

// Fallback error handler so unexpected errors return JSON, not an HTML stack trace.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Unexpected server error' });
});

const PORT = process.env.PORT || 5000;

// Start listening FIRST, then run startup migrations in the background.
// These used to block server.listen() until they finished - fine normally,
// but loadDpcCentres does up to ~874 upserts on its very first run ever,
// which on a free Render instance talking to a free-tier Atlas cluster
// could be slow enough to fail Render's health check before the port even
// opens. None of these migrations are needed to serve most routes
// immediately, so there's no reason to hold the port closed for them.
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`[server] Procurement Queue backend running on port ${PORT}`);
  });

  (async () => {
    try {
      await ensureCentreDefaults();
    } catch (err) {
      // Never let a migration hiccup crash the API - it will simply retry
      // on the next deploy/restart.
      console.error('[migrate] ensureCentreDefaults failed (will retry next startup):', err.message);
    }
    try {
      await loadDpcCentres();
    } catch (err) {
      console.error('[migrate] loadDpcCentres failed (will retry next startup):', err.message);
    }
    try {
      await ensureCropRateDefaults();
    } catch (err) {
      console.error('[migrate] ensureCropRateDefaults failed (will retry next startup):', err.message);
    }
  })();
});
