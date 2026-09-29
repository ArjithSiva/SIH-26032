const Booking = require('../models/Booking');
const { broadcastEvent } = require('../utils/notificationSimulator');
const { assertOfficerOwnsCentre } = require('../middleware/auth');

// GET /api/payments/requests
// Admin's "Payment Requests" queue - every booking currently sitting with
// admin, either awaiting a decision ('requested') or already accepted and
// being processed ('processing'). Admin is unrestricted, so this spans
// every centre - that's the whole point of centralising this step.
async function getPaymentRequests(req, res) {
  try {
    const bookings = await Booking.find({ paymentStatus: { $in: ['requested', 'processing'] } })
      .populate('farmer', 'name mobileNumber')
      .populate('centre', 'name code')
      .sort({ paymentRequestedAt: 1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch payment requests', error: err.message });
  }
}

// POST /api/payments/:bookingId/request
// The procurement centre's (officer's) side of this flow, now: instead of
// processing and completing the payment themselves, an officer can only
// ever send it to admin for review. Only valid once procurement is
// actually done and no request has gone out yet.
async function requestPayment(req, res) {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    assertOfficerOwnsCentre(req, booking.centre);

    if (booking.procurementStage !== 'procurement_completed' || booking.paymentStatus !== 'pending') {
      return res.status(409).json({ message: 'A payment request can only be sent once procurement is complete and no request has already been sent' });
    }

    booking.paymentStatus = 'requested';
    booking.paymentRequestedAt = new Date();
    await booking.save();

    const io = req.app.get('io');
    await broadcastEvent(io, {
      recipientRole: 'admin',
      event: 'payment_request_received',
      templates: {
        push: `New payment request for token ${booking.token} (Rs. ${booking.estimatedValue ?? 'N/A'}) - awaiting your review.`,
      },
    });
    await broadcastEvent(io, {
      farmer: booking.farmer,
      event: 'payment_request_sent',
      templates: {
        sms: `Your payment request for token ${booking.token} has been submitted and is awaiting approval.`,
        push: `Payment request submitted for token ${booking.token}. We'll notify you once it's approved.`,
      },
    });

    res.json(booking);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Could not send payment request' });
  }
}

// POST /api/payments/:bookingId/process
// Admin accepting a request - "proceeding the process": this is what
// actually sends it to the government, replacing what used to be the
// officer's own "start processing" button.
async function processPayment(req, res) {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.paymentStatus !== 'requested') {
      return res.status(409).json({ message: 'Only a requested payment can be accepted for processing' });
    }

    booking.paymentStatus = 'processing';
    booking.procurementStage = 'payment_processing';
    await booking.save();

    const io = req.app.get('io');
    await broadcastEvent(io, {
      farmer: booking.farmer,
      event: 'payment_request_sent',
      templates: {
        sms: `Your payment request for token ${booking.token} has been accepted and sent to the government for processing.`,
        push: `Payment request accepted for token ${booking.token} - now with the government for processing.`,
      },
    });
    await broadcastEvent(io, {
      recipientRole: 'officer',
      centre: booking.centre,
      event: 'payment_request_sent',
      templates: {
        push: `Payment request for token ${booking.token} has been accepted and sent to the Government for processing.`,
      },
    });

    res.json(booking);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Could not process payment request' });
  }
}

// POST /api/payments/:bookingId/complete  { paidAmount? }
// Admin's final step - "finishing the process": marks the payment as
// actually received in the farmer's bank account.
async function completePayment(req, res) {
  try {
    const { paidAmount } = req.body;
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.paymentStatus !== 'processing') {
      return res.status(409).json({ message: 'Only a payment already being processed can be marked completed' });
    }

    booking.paymentStatus = 'completed';
    booking.paidAmount = paidAmount ?? booking.estimatedValue;
    booking.paidAt = new Date();
    booking.procurementStage = 'payment_completed';
    await booking.save();

    const io = req.app.get('io');
    await broadcastEvent(io, {
      farmer: booking.farmer,
      event: 'payment_completed',
      templates: {
        sms: `Payment of Rs. ${booking.paidAmount} completed for token ${booking.token}.`,
        whatsapp: `Your payment of Rs. ${booking.paidAmount} for token ${booking.token} has been processed and received in your bank account.`,
      },
    });
    await broadcastEvent(io, {
      recipientRole: 'officer',
      centre: booking.centre,
      event: 'payment_completed',
      templates: {
        push: `Payment of Rs. ${booking.paidAmount} for token ${booking.token} has been processed and received in the farmer's bank account.`,
      },
    });

    res.json(booking);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Could not complete payment' });
  }
}

module.exports = { getPaymentRequests, requestPayment, processPayment, completePayment };
