const Booking = require('../models/Booking');
const Centre = require('../models/Centre');
const { broadcastEvent } = require('../utils/notificationSimulator');
const { ensureSlotsForDate } = require('../utils/slotGenerator');

// GET /api/queue/centre/:centreId/date/:date
// Everything an officer's dashboard needs to render "today's queue" - or
// any other day's, since the date is just a path param the frontend's date
// picker can set to whatever day the officer wants to review.
async function getCentreQueue(req, res) {
  try {
    const { centreId, date } = req.params;
    const bookings = await Booking.find({ centre: centreId, date })
      .populate('farmer', 'name mobileNumber')
      .sort({ startTime: 1, createdAt: 1 });

    const centre = await Centre.findById(centreId);
    const slots = centre ? await ensureSlotsForDate(centre, date) : [];
    const totalCapacityToday = slots.reduce((sum, s) => sum + s.capacity, 0);

    const completed = bookings.filter((b) => b.queueStatus === 'completed').length;
    const cancelledOrAbsent = bookings.filter((b) => ['cancelled', 'absent'].includes(b.queueStatus)).length;

    const summary = {
      totalBooked: bookings.length,
      checkedIn: bookings.filter((b) => b.procurementStage !== 'booked').length,
      completed,
      waiting: bookings.filter((b) => b.queueStatus === 'waiting').length,
      remainingToday: Math.max(totalCapacityToday - completed - cancelledOrAbsent, 0),
    };

    res.json({ bookings, summary });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch queue', error: err.message });
  }
}

// POST /api/queue/:bookingId/check-in
async function checkIn(req, res) {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    booking.checkedInAt = new Date();
    booking.procurementStage = 'checked_in';
    await booking.save();
    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: 'Check-in failed', error: err.message });
  }
}

// POST /api/queue/:bookingId/call-next
// Marks this booking as "processing" (and, if another booking in the same
// slot was already processing, completes it first).
async function callNext(req, res) {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    await Booking.updateMany(
      { slot: booking.slot, queueStatus: 'processing' },
      { queueStatus: 'completed', completedAt: new Date() }
    );

    booking.queueStatus = 'processing';
    booking.calledAt = new Date();
    await booking.save();

    const io = req.app.get('io');
    io.to(`centre:${booking.centre}`).emit('queue:update', { bookingId: booking._id, status: 'processing' });
    await broadcastEvent(io, {
      farmer: booking.farmer,
      event: 'queue_approaching',
      templates: {
        push: `Your turn is approaching. Token ${booking.token} is now being processed.`,
      },
    });

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: 'Could not advance queue', error: err.message });
  }
}

// POST /api/queue/:bookingId/mark-absent
async function markAbsent(req, res) {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.bookingId,
      { queueStatus: 'absent' },
      { new: true }
    );
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: 'Could not update booking', error: err.message });
  }
}

module.exports = { getCentreQueue, checkIn, callNext, markAbsent };
