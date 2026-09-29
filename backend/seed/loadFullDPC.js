require('dotenv').config();
const mongoose = require('mongoose');
const { loadDpcCentres } = require('../utils/loadDpcCentres');

// Thin CLI wrapper around utils/loadDpcCentres.js, kept for anyone who wants
// to force-refresh the real centre list by hand (e.g. right after
// npm run scrape:dpc pulls a new snapshot). The same logic now also runs
// automatically on every server startup (see server.js) so this script is
// no longer required for a normal deploy to have real centres.
async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('Set MONGODB_URI in backend/.env before loading DPC data.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  await loadDpcCentres({ force: true });
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Loading DPC data failed:', err.message);
  process.exit(1);
});
