const Booking = require('../models/Booking');
const CropRate = require('../models/CropRate');
const { broadcastEvent } = require('../utils/notificationSimulator');
const { assertOfficerOwnsCentre } = require('../middleware/auth');

// POST /api/procurement/:bookingId/stage  { stage }
async function updateStage(req, res) {
  try {
    const { stage } = req.body;
    if (!Booking.PROCUREMENT_STAGES.includes(stage)) {
      return res.status(400).json({ message: `stage must be one of: ${Booking.PROCUREMENT_STAGES.join(', ')}` });
    }

    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    assertOfficerOwnsCentre(req, booking.centre);

    booking.procurementStage = stage;
    if (stage === 'procurement_completed') {
      booking.paymentStatus = 'pending';
    }
    await booking.save();

    if (stage === 'procurement_completed') {
      const io = req.app.get('io');
      await broadcastEvent(io, {
        farmer: booking.farmer,
        event: 'procurement_completed',
        templates: {
          sms: `Your procurement for token ${booking.token} is complete. Your payment process has now been initiated.`,
          push: `Procurement complete for ${booking.token}. Payment process initiated - we'll notify you as it progresses.`,
        },
      });
    }

    res.json(booking);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Could not update stage' });
  }
}

// POST /api/procurement/:bookingId/quantity  { crop, quantity }
// The system never predicts a price - it multiplies quantity by the
// admin-configured official rate, exactly as the brief specifies.
// `quantity` is in whatever unit that crop's CropRate uses (e.g. bags).
async function recordQuantity(req, res) {
  try {
    const { crop, quantity } = req.body;
    if (!crop || !quantity) {
      return res.status(400).json({ message: 'crop and quantity are required' });
    }

    const rate = await CropRate.findOne({ crop });
    if (!rate) {
      return res.status(404).json({ message: `No official rate configured for crop "${crop}"` });
    }

    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    assertOfficerOwnsCentre(req, booking.centre);

    booking.crop = crop;
    booking.unit = rate.unit;
    booking.quantity = quantity;
    booking.officialRatePerUnit = rate.ratePerUnit;
    booking.estimatedValue = Number((quantity * rate.ratePerUnit).toFixed(2));
    await booking.save();

    res.json(booking);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Could not record quantity' });
  }
}

module.exports = { updateStage, recordQuantity };
