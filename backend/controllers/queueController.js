const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Centre = require('../models/Centre');
const Slot = require('../models/Slot');
const { broadcastEvent } = require('../utils/notificationSimulator');
const { ensureSlotsForDate } = require('../utils/slotGenerator');
const { assertOfficerOwnsCentre } = require('../middleware/auth');

// GET /api/queue/centre/:centreId/date/:date
// Everything an officer's dashboard needs to render "today's queue" - or
// any other day's, since the date is just a path param the frontend's date
// picker can set to whatever day the officer wants to review.
async function getCentreQueue(req, res) {
  try {
    const { centreId, date } = req.params;
    assertOfficerOwnsCentre(req, centreId);

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
    res.status(err.status || 500).json({ message: err.message || 'Could not fetch queue', error: err.message });
  }
}

// POST /api/queue/:bookingId/check-in
async function checkIn(req, res) {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    assertOfficerOwnsCentre(req, booking.centre);

    booking.checkedInAt = new Date();
    booking.procurementStage = 'checked_in';
    await booking.save();

    // Emit here too, not just on call-next - any dashboard watching this
    // centre's queue (a second officer tab, an admin's overview) should see
    // a check-in land live, since it changes who's next in line.
    const io = req.app.get('io');
    io.to(`centre:${booking.centre}`).emit('queue:update', { bookingId: booking._id, status: 'checked_in' });

    res.json(booking);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Check-in failed' });
  }
}

// POST /api/queue/:bookingId/call-next
// Marks this booking as "processing" (and, if another booking in the same
// slot was already processing, completes it first).
async function callNext(req, res) {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    assertOfficerOwnsCentre(req, booking.centre);

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
    res.status(err.status || 500).json({ message: err.message || 'Could not advance queue' });
  }
}

// POST /api/queue/:bookingId/mark-absent
// A no-show still needs to free up its seat - previously this only flipped
// queueStatus to 'absent' and left the slot's bookedCount untouched, so a
// slot with an absent farmer stayed "full" for the rest of the day even
// though no one would actually occupy that spot. Now it releases the seat
// the same way a cancellation does, so a walk-in (or another farmer's
// reschedule) can take it.
async function markAbsent(req, res) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const booking = await Booking.findById(req.params.bookingId).session(session);
      if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 });
      assertOfficerOwnsCentre(req, booking.centre);

      const slot = await Slot.findById(booking.slot).session(session);
      if (slot) {
        slot.bookedCount = Math.max(0, slot.bookedCount - 1);
        await slot.save({ session });
      }

      booking.queueStatus = 'absent';
      await booking.save({ session });
      result = booking;
    });

    const io = req.app.get('io');
    io.to(`centre:${result.centre}`).emit('queue:update', { bookingId: result._id, status: 'absent' });

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Could not update booking' });
  } finally {
    session.endSession();
  }
}

module.exports = { getCentreQueue, checkIn, callNext, markAbsent };
