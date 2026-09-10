const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Centre = require('../models/Centre');
const { districtCode } = require('./tnGeo');
const { DEFAULT_OFFICER_PASSWORD } = require('./ensureCentreDefaults');
const dataset = require('../seed/data/dpc-open-full.json');

/**
 * Upserts the real 874-centre TNCSC DPC dataset into the `centres`
 * collection. This used to only run as a one-off manual script
 * (`npm run seed:dpc`) - which meant a fresh deploy against a fresh
 * database (or one where that script was simply never run) would only
 * ever have the 3 fake demo centres from the baseline seed, with no real
 * centres for farmers to book against ("only 3 centres show up" bug).
 *
 * Runs automatically at server startup (see server.js), same as
 * ensureCentreDefaults. Safe to run every time: every write here is an
 * upsert keyed on (district, taluk, village), so after the first run this
 * is just a fast no-op scan unless the source dataset has actually changed.
 *
 * Kept as a plain function (rather than only a CLI script) specifically so
 * it can be called from server.js without spawning a child process.
 */
async function loadDpcCentres({ force = false } = {}) {
  if (mongoose.connection.readyState !== 1) {
    console.warn('[migrate] Database not connected - skipping DPC centre load for this startup.');
    return;
  }

  const existingCount = await Centre.countDocuments({ sourceLastScrapedAt: { $ne: null } });
  if (!force && existingCount >= dataset.centres.length) {
    // Every known real centre is already present - normal case on every
    // startup after the first. Skip the load entirely so this doesn't add
    // any extra work to every deploy/restart.
    return;
  }

  console.log(
    `[migrate] Only ${existingCount}/${dataset.centres.length} real DPC centres found - loading the rest from ${dataset.sourceLabel}...`
  );

  const defaultPasswordHash = await bcrypt.hash(DEFAULT_OFFICER_PASSWORD, 10);

  // Two queries up front instead of one (or two) per row: which
  // district/taluk/village combos already exist, and how many centres each
  // district already has (to seed the codePrefix sequence numbers) - this
  // is what makes this safe to run as a single bulkWrite instead of ~1700
  // sequential round trips, which is what made the very first run of this
  // slow enough to risk a Render free-tier deploy health-check timeout.
  const existingKeys = new Set(
    (await Centre.find({}, 'district taluk village').lean()).map((c) => `${c.district}|${c.taluk}|${c.village}`)
  );
  const districtCounts = {};
  (await Centre.aggregate([{ $group: { _id: '$district', count: { $sum: 1 } } }])).forEach((row) => {
    districtCounts[row._id] = row.count;
  });

  const ops = dataset.centres.map((row) => {
    const key = `${row.district}|${row.taluk}|${row.village}`;
    const isNew = !existingKeys.has(key);
    let codePrefix;
    if (isNew) {
      // Derived from an in-memory running count seeded from the real
      // database count, rather than re-querying per row like
      // generateCentrePrefix does - equivalent result, far fewer round
      // trips. codePrefix has a unique index as a safety net in the rare
      // case this ever collides with something outside this dataset.
      districtCounts[row.district] = (districtCounts[row.district] || 0) + 1;
      codePrefix = `${districtCode(row.district)}-${String(districtCounts[row.district]).padStart(3, '0')}`;
    }

    return {
      updateOne: {
        filter: { district: row.district, taluk: row.taluk, village: row.village },
        update: {
          $set: {
            name: `${row.village} DPC`,
            district: row.district,
            taluk: row.taluk,
            village: row.village,
            location: row.location,
            seasonOpeningDate: row.seasonOpeningDate ? new Date(row.seasonOpeningDate) : null,
            seasonClosingDate: null,
            dpcStatus: 'Open',
            isActive: true,
            sourceLastScrapedAt: new Date(dataset.capturedAt),
          },
          $setOnInsert: {
            crops: [{ name: 'Paddy', maxQuantity: null }],
            state: 'Tamil Nadu',
            officerPasswordHash: defaultPasswordHash,
            mustChangeOfficerPassword: true,
            ...(codePrefix ? { codePrefix } : {}),
          },
        },
        upsert: true,
      },
    };
  });

  // ordered: false so one bad/colliding row (e.g. a codePrefix clash) can't
  // block every other centre in the batch from loading.
  const result = await Centre.bulkWrite(ops, { ordered: false });
  const writeErrorCount = result.getWriteErrors?.().length || 0;

  console.log(
    `[migrate] DPC centre load done - created ${result.upsertedCount}, updated ${result.modifiedCount}` +
      (writeErrorCount ? `, ${writeErrorCount} row(s) failed (see below)` : '') +
      `. Default officer password for any freshly-created centre is "${DEFAULT_OFFICER_PASSWORD}".`
  );
  if (writeErrorCount) {
    console.warn('[migrate] DPC load write errors:', result.getWriteErrors().map((e) => e.errmsg));
  }
}

module.exports = { loadDpcCentres };
