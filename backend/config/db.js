const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.warn(
      '[db] MONGODB_URI is not set. The API will start, but every ' +
      'database-backed route will fail until you add a connection ' +
      'string to backend/.env (copy .env.example to get started).'
    );
    return;
  }

  try {
    await mongoose.connect(uri);
    console.log('[db] Connected to MongoDB');
  } catch (err) {
    console.error('[db] Failed to connect to MongoDB:', err.message);
    console.error(
      '[db] The server will keep running so you can still hit ' +
      'non-DB routes (e.g. /health), but data routes will error out.'
    );
  }
}

module.exports = connectDB;
