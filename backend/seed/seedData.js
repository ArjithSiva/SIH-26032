require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const CropRate = require('../models/CropRate');
const Staff = require('../models/Staff');
const Farmer = require('../models/Farmer');

// IMPORTANT: this script is wired into the Render deploy command
// (`npm install && npm run seed`), which runs on *every* deploy. It used to
// `deleteMany({})` Centres, CropRates, Staff and Farmers and recreate 3
// fake demo centres from scratch - which meant every redeploy destroyed
// real registered farmers and the 874 real DPC centres loaded via
// `npm run seed:dpc`, silently reintroducing the fake centres alongside
// whatever survived. This version only *ensures baseline reference data
// exists* (upsert, never delete), so it's safe to run on every deploy.
// Centre data is owned entirely by seed:dpc / scrape:dpc / the admin panel.
async function seed() {
  if (!process.env.MONGODB_URI) {
    console.error('Set MONGODB_URI in backend/.env before seeding.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected. Ensuring baseline reference data exists (non-destructive)...');

  await Promise.all(
    [
      { crop: 'Paddy', unit: 'bag', unitWeightKg: 50, ratePerUnit: 1075 },
      { crop: 'Maize', unit: 'bag', unitWeightKg: 50, ratePerUnit: 985 },
      { crop: 'Groundnut', unit: 'bag', unitWeightKg: 50, ratePerUnit: 2910 },
    ].map((r) => CropRate.findOneAndUpdate({ crop: r.crop }, { $setOnInsert: r }, { upsert: true }))
  );

  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  await Staff.findOneAndUpdate(
    { username: 'admin' },
    {
      $setOnInsert: {
        name: 'State Admin',
        username: 'admin',
        passwordHash: adminPasswordHash, // only set if the account doesn't already exist - an admin who
        role: 'admin',                   // changed their password later won't get reset on the next deploy
        centre: null,
      },
    },
    { upsert: true }
  );

  await Farmer.findOneAndUpdate(
    { mobileNumber: '9876543210' },
    {
      $setOnInsert: {
        name: 'Murugan S',
        mobileNumber: '9876543210',
        preferredLanguage: 'ta',
        registeredAt: 'Thanjavur CSC',
        registeredVia: 'centre_staff',
      },
    },
    { upsert: true }
  );

  console.log('Seed complete.');
  console.log('  Admin login    -> username: admin  password: admin123');
  console.log('  Officer login  -> pick your centre from the search list at /officer/login (each centre has its own password now - see the admin panel\'s Centres tab)');
  console.log('  Demo farmer    -> mobile: 9876543210 (use OTP flow to log in; dev OTP is returned in the API response)');
  console.log('  Centres        -> run `npm run seed:dpc` to load the real 874 open DPC centres if not already loaded');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
