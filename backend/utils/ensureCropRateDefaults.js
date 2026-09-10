const mongoose = require('mongoose');

// Same canonical rates seed/seedData.js uses for a brand-new database - the
// only crops this app has ever shipped with a known official rate for.
const KNOWN_DEFAULTS = {
  Paddy: { unit: 'bag', unitWeightKg: 50, ratePerUnit: 1075 },
  Maize: { unit: 'bag', unitWeightKg: 50, ratePerUnit: 985 },
  Groundnut: { unit: 'bag', unitWeightKg: 50, ratePerUnit: 2910 },
};

/**
 * Runs once at server startup (see server.js). `upsertCropRate` used to
 * accept anything that wasn't null/undefined, including NaN - so a
 * non-numeric value typed into the rate field would pass validation, get
 * saved to MongoDB as a literal NaN, and render as "₹NaN" forever with no
 * way to fix it from the UI (see the validation fix in adminController.js,
 * which stops this happening again going forward). This repairs any rate
 * already broken that way.
 *
 * For a crop this app ships a known official default for, restores that
 * default. For anything else, there's no safe value to invent - those are
 * left as-is but logged clearly so an admin can fix them from the Crop
 * Rates tab (now that it also has an inline edit for existing rates).
 */
async function ensureCropRateDefaults() {
  if (mongoose.connection.readyState !== 1) {
    console.warn('[migrate] Database not connected - skipping crop-rate repair for this startup.');
    return;
  }

  // This collection only ever holds a handful of documents (one per crop),
  // so it's simpler and more reliable to filter for NaN in plain JS than to
  // rely on MongoDB's query-level NaN matching, which behaves inconsistently
  // across driver/server versions.
  const raw = mongoose.connection.db.collection('croprates');
  const all = await raw.find({}).toArray();
  const broken = all.filter((doc) => doc.ratePerUnit == null || Number.isNaN(doc.ratePerUnit));

  if (broken.length === 0) {
    console.log('[migrate] All crop rates already have a valid ratePerUnit - nothing to do.');
    return;
  }

  let repaired = 0;
  const stillBroken = [];

  const ops = broken.map((doc) => {
    const fallback = KNOWN_DEFAULTS[doc.crop];
    if (fallback) {
      repaired += 1;
      return {
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { ratePerUnit: fallback.ratePerUnit, unit: doc.unit || fallback.unit, unitWeightKg: doc.unitWeightKg ?? fallback.unitWeightKg } },
        },
      };
    }
    stillBroken.push(doc.crop);
    return null;
  }).filter(Boolean);

  if (ops.length > 0) {
    await raw.bulkWrite(ops);
  }

  console.log(`[migrate] Crop rate repair: fixed ${repaired} of ${broken.length} broken rate(s) using known defaults.`);
  if (stillBroken.length > 0) {
    console.warn(
      `[migrate] These crop rates still need a value set manually from the admin Crop Rates tab (no known default to fall back to): ${stillBroken.join(', ')}`
    );
  }
}

module.exports = { ensureCropRateDefaults, KNOWN_DEFAULTS };
