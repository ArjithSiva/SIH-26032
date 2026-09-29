const Slot = require('../models/Slot');

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function toHHMM(totalMinutes) {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']; // Date#getDay() is 0=Sunday

/**
 * Ensures Slot documents exist for a given centre + date, generated from the
 * centre's opening/closing time, slot duration and per-slot capacity. Safe to
 * call repeatedly - existing slots for that centre/date are left untouched,
 * missing ones are created. This is what lets a centre's hours/capacity be
 * configured once in the admin panel rather than hardcoded.
 *
 * If the date falls on a day the centre doesn't work (see Centre.workingDays),
 * no slots are generated at all - the centre simply isn't bookable that day.
 */
async function ensureSlotsForDate(centre, date) {
  if (centre.workingDays && centre.workingDays.length > 0) {
    const weekday = WEEKDAY_CODES[new Date(`${date}T00:00:00`).getDay()];
    if (!centre.workingDays.includes(weekday)) return [];
  }

  const start = toMinutes(centre.openingTime);
  const end = toMinutes(centre.closingTime);
  const duration = centre.slotDurationMinutes;

  const windows = [];
  for (let t = start; t + duration <= end; t += duration) {
    windows.push({ startTime: toHHMM(t), endTime: toHHMM(t + duration) });
  }

  const existing = await Slot.find({ centre: centre._id, date }).select('startTime');
  const existingTimes = new Set(existing.map((s) => s.startTime));

  const toCreate = windows
    .filter((w) => !existingTimes.has(w.startTime))
    .map((w) => ({
      centre: centre._id,
      date,
      startTime: w.startTime,
      endTime: w.endTime,
      capacity: centre.capacityPerSlot,
      bookedCount: 0,
    }));

  if (toCreate.length) {
    await Slot.insertMany(toCreate, { ordered: false }).catch(() => {
      // Ignore duplicate-key races from concurrent requests generating the
      // same date at the same time; the slots already exist either way.
    });
  }

  return Slot.find({ centre: centre._id, date }).sort({ startTime: 1 });
}

/**
 * Simple, explainable (non-ML) slot recommendation: the available slot with
 * the lowest expected waiting time, estimated as (farmers ahead) * (average
 * minutes per farmer). This intentionally does not use machine learning -
 * per the brief, it's meant to be transparent, not predictive.
 */
function recommendSlot(slots, avgMinutesPerFarmer = 2.5) {
  const candidates = slots.filter((s) => s.status !== 'full' && s.status !== 'closed');
  if (!candidates.length) return null;

  const scored = candidates.map((s) => ({
    slot: s,
    estimatedWaitMinutes: Math.round(s.bookedCount * avgMinutesPerFarmer),
  }));

  scored.sort((a, b) => a.estimatedWaitMinutes - b.estimatedWaitMinutes);
  return scored[0];
}

module.exports = { ensureSlotsForDate, recommendSlot, toMinutes, toHHMM };
