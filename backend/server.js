require('dotenv').config();
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

const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN || '*' },
});

app.set('io', io);
registerSocketHandlers(io);

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
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
