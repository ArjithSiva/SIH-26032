const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const DEFAULT_OFFICER_PASSWORD = process.env.DEFAULT_OFFICER_PASSWORD || 'centre123';

const DEFAULT_POLICY_LIMITS = {
  earliestOpeningTime: '06:00',
  latestClosingTime: '20:00',
  minSlotDurationMinutes: 30,
  maxSlotDurationMinutes: 120,
  minCapacityPerSlot: 5,
  maxCapacityPerSlot: 100,
};
const DEFAULT_WORKING_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

/**
 * Runs once at server startup (see server.js). Every centre created before a
 * given field existed in the schema simply doesn't have that field in
 * MongoDB - Mongoose schema defaults only apply to documents created AFTER
 * the default was added, never retroactively. Without this, centres seeded
 * before the `crops[]` / `officerPasswordHash` / `policyLimits` fields
 * existed silently have none of them: crop dropdowns come up empty and
 * officer login has no password to check against.
 *
 * Reads raw documents via the native collection (bypassing the Mongoose
 * schema, which would otherwise hide old field names like the legacy
 * `supportedCrops` string array) so old data can be translated into the
 * current shape instead of just being defaulted away.
 *
 * Safe to run on every startup: only touches documents that are actually
 * missing something, so after the first run it's a fast no-op scan.
 */
async function ensureCentreDefaults() {
  // Guard against running before the connection is actually ready (e.g. no
  // MONGODB_URI configured, or Atlas still connecting) - querying through
  // Mongoose's buffering layer in that state can hang for the full buffer
  // timeout and crash the process with an unhandled rejection instead of
  // failing fast. Skipping here is safe: connectDB already logs clearly
  // when there's no database, and this migration simply runs again next
  // time the server restarts once a connection exists.
  if (mongoose.connection.readyState !== 1) {
    console.warn('[migrate] Database not connected - skipping centre backfill for this startup.');
    return;
  }

  // Goes through the native driver directly (not Centre.collection) so
  // behaviour here is a plain, predictable Cursor - not Mongoose's
  // connection-aware buffering wrapper.
  const raw = mongoose.connection.db.collection('centres');
  const defaultPasswordHash = await bcrypt.hash(DEFAULT_OFFICER_PASSWORD, 10);

  const candidates = await raw
    .find({
      $or: [
        { crops: { $exists: false } },
        { crops: { $size: 0 } },
        { officerPasswordHash: { $exists: false } },
        { officerPasswordHash: null },
        { policyLimits: { $exists: false } },
        { workingDays: { $exists: false } },
      ],
    })
    .toArray();

  if (candidates.length === 0) {
    console.log('[migrate] All centres already have current-schema fields - nothing to do.');
    return;
  }

  console.log(`[migrate] Backfilling ${candidates.length} centre(s) onto the current schema...`);

  const ops = candidates.map((doc) => {
    const set = {};

    if (!doc.crops || doc.crops.length === 0) {
      if (Array.isArray(doc.supportedCrops) && doc.supportedCrops.length > 0) {
        set.crops = doc.supportedCrops.map((name) => ({ name, maxQuantity: null }));
      } else {
        // DPCs in this dataset are paddy-only per TNCSC's own description.
        set.crops = [{ name: 'Paddy', maxQuantity: null }];
      }
    }

    if (!doc.officerPasswordHash) {
      set.officerPasswordHash = defaultPasswordHash;
      set.mustChangeOfficerPassword = true;
    }

    if (!doc.policyLimits) {
      set.policyLimits = DEFAULT_POLICY_LIMITS;
    }

    if (!doc.workingDays) {
      set.workingDays = DEFAULT_WORKING_DAYS;
    }

    return { updateOne: { filter: { _id: doc._id }, update: { $set: set } } };
  });

  const result = await raw.bulkWrite(ops);
  console.log(
    `[migrate] Done - ${result.modifiedCount} centre(s) updated. ` +
      `Default officer password for any freshly-backfilled centre is "${DEFAULT_OFFICER_PASSWORD}" - change it from the admin panel.`
  );
}

module.exports = { ensureCentreDefaults, DEFAULT_OFFICER_PASSWORD };
