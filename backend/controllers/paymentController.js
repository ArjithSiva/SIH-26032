const Booking = require('../models/Booking');
const { broadcastEvent } = require('../utils/notificationSimulator');

// POST /api/payments/:bookingId  { status: 'processing' | 'completed', paidAmount? }
async function updatePaymentStatus(req, res) {
  try {
    const { status, paidAmount } = req.body;
    if (!['processing', 'completed'].includes(status)) {
      return res.status(400).json({ message: 'status must be "processing" or "completed"' });
    }

    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    booking.paymentStatus = status;
    if (status === 'completed') {
      booking.paidAmount = paidAmount ?? booking.estimatedValue;
      booking.paidAt = new Date();
      booking.procurementStage = 'payment_completed';
    } else {
      booking.procurementStage = 'payment_processing';
    }
    await booking.save();

    if (status === 'completed') {
      const io = req.app.get('io');
      await broadcastEvent(io, {
        farmer: booking.farmer,
        event: 'payment_completed',
        templates: {
          sms: `Payment of Rs. ${booking.paidAmount} completed for token ${booking.token}.`,
          whatsapp: `Your payment of Rs. ${booking.paidAmount} for token ${booking.token} has been completed.`,
        },
      });
    }

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: 'Could not update payment status', error: err.message });
  }
}

module.exports = { updatePaymentStatus };
