const Booking = require('../models/Booking');
const CropRate = require('../models/CropRate');
const { broadcastEvent } = require('../utils/notificationSimulator');

// POST /api/procurement/:bookingId/stage  { stage }
async function updateStage(req, res) {
  try {
    const { stage } = req.body;
    if (!Booking.PROCUREMENT_STAGES.includes(stage)) {
      return res.status(400).json({ message: `stage must be one of: ${Booking.PROCUREMENT_STAGES.join(', ')}` });
    }

    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

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
          sms: `Procurement completed for token ${booking.token}. Payment will be processed shortly.`,
        },
      });
    }

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: 'Could not update stage', error: err.message });
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

    booking.crop = crop;
    booking.unit = rate.unit;
    booking.quantity = quantity;
    booking.officialRatePerUnit = rate.ratePerUnit;
    booking.estimatedValue = Number((quantity * rate.ratePerUnit).toFixed(2));
    await booking.save();

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: 'Could not record quantity', error: err.message });
  }
}

module.exports = { updateStage, recordQuantity };
