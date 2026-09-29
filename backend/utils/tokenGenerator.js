const Slot = require('../models/Slot');

/**
 * Turns a crop name into a short, uppercase, alphanumeric-only token
 * segment. Indian procurement crop names are already short (Paddy, Maize,
 * Groundnut...) so this keeps the full name rather than truncating it -
 * truncating "Groundnut" to "GRO" reads worse than just keeping it whole.
 */
function cropCode(crop) {
  const clean = (crop || 'CROP').toUpperCase().replace(/[^A-Z0-9]+/g, '');
  return clean || 'CROP';
}

function dateCompact(dateStr) {
  return (dateStr || '').replace(/-/g, ''); // "2026-09-08" -> "20260908"
}

/**
 * 1-based position of a slot among all of a centre's slots on a given date,
 * ordered by start time - the "slot no" segment of the token, e.g. the
 * 8-9am slot is S1, 9-10am is S2, and so on. This is purely about *which
 * slot*, unrelated to queue position.
 */
async function slotIndexFor(centreId, date, slotId) {
  const daySlots = await Slot.find({ centre: centreId, date }).sort({ startTime: 1 }).select('_id');
  const index = daySlots.findIndex((s) => String(s._id) === String(slotId));
  return index === -1 ? 1 : index + 1;
}

/**
 * Builds the composite booking token:
 *   <centre code prefix>-<date>-<crop>-S<slot no>-Q<daily queue no>
 * e.g. "TNJ-014-20260908-PADDY-S3-Q05"
 *
 * dailyQueueNumber is the farmer's 1-based position among ALL bookings at
 * this centre on this date (across every slot) - it starts at 1 for the
 * first farmer to book at a centre each new day, then 2, 3... regardless
 * of which slot each farmer picks. See bookingController for how it's
 * computed and why it's stored on the booking rather than recalculated.
 */
async function buildToken({ centre, date, crop, slotId, dailyQueueNumber }) {
  const slotIndex = await slotIndexFor(centre._id, date, slotId);
  const queuePart = String(dailyQueueNumber).padStart(2, '0');
  return `${centre.codePrefix || 'GEN-000'}-${dateCompact(date)}-${cropCode(crop)}-S${slotIndex}-Q${queuePart}`;
}

module.exports = { buildToken, cropCode, dateCompact, slotIndexFor };
