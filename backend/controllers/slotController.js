const Centre = require('../models/Centre');
const { ensureSlotsForDate, recommendSlot } = require('../utils/slotGenerator');

// GET /api/slots?centreId=...&date=YYYY-MM-DD
async function getSlotsForDate(req, res) {
  try {
    const { centreId, date } = req.query;
    if (!centreId || !date) {
      return res.status(400).json({ message: 'centreId and date are required' });
    }

    const centre = await Centre.findById(centreId);
    if (!centre) return res.status(404).json({ message: 'Centre not found' });

    const slots = await ensureSlotsForDate(centre, date);
    const recommendation = recommendSlot(slots);

    res.json({
      slots,
      recommendedSlotId: recommendation ? recommendation.slot._id : null,
      recommendation,
    });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch slots', error: err.message });
  }
}

// Returns the next N available dates (skips nothing fancy - just calendar
// days - since the brief's IVR example presents "the next few available
// dates" rather than a full date picker).
async function getUpcomingDates(req, res) {
  try {
    const { days = 5 } = req.query;
    const dates = [];
    const today = new Date();
    for (let i = 0; i < Number(days); i += 1) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }
    res.json({ dates });
  } catch (err) {
    res.status(500).json({ message: 'Could not compute dates', error: err.message });
  }
}

module.exports = { getSlotsForDate, getUpcomingDates };
