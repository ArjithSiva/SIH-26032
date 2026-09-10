const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Slot = require('../models/Slot');
const Centre = require('../models/Centre');
const Farmer = require('../models/Farmer');
const CropRate = require('../models/CropRate');
const { buildToken } = require('../utils/tokenGenerator');
const { broadcastEvent } = require('../utils/notificationSimulator');

const PAYMENT_ETA_DAYS = 3; // simulated - "instant" backend, but still labelled as an estimate to the farmer

function maskAccountNumber(accountNumber) {
  if (!accountNumber) return null;
  return accountNumber.slice(-4);
}

// POST /api/bookings
// { farmerId, slotId, crop, plannedQuantity, bankDetails?, channel }
// Used identically by the web app and the IVR simulator - this is the one
// booking code path both channels share, per the brief's architecture.
async function createBooking(req, res) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const { farmerId, slotId, crop, plannedQuantity, bankDetails, channel = 'web' } = req.body;
      if (!farmerId || !slotId) {
        throw Object.assign(new Error('farmerId and slotId are required'), { status: 400 });
      }

      const slot = await Slot.findById(slotId).session(session);
      if (!slot) throw Object.assign(new Error('Slot not found'), { status: 404 });
      if (slot.isClosed || slot.bookedCount >= slot.capacity) {
        throw Object.assign(new Error('This slot is no longer available'), { status: 409 });
      }

      const farmer = await Farmer.findById(farmerId).session(session);
      if (!farmer) throw Object.assign(new Error('Farmer not found'), { status: 404 });

      const centre = await Centre.findById(slot.centre).session(session);
      if (!centre) throw Object.assign(new Error('Centre not found'), { status: 404 });

      // Bank details: persist to the farmer's profile (so future bookings
      // prefill it) and snapshot the masked version onto this booking.
      if (bankDetails && bankDetails.accountNumber) {
        farmer.bankDetails = {
          accountHolderName: bankDetails.accountHolderName,
          bankName: bankDetails.bankName,
          accountNumber: bankDetails.accountNumber,
          ifscCode: bankDetails.ifscCode,
        };
        await farmer.save({ session });
      }
      const effectiveBank = bankDetails?.accountNumber ? bankDetails : farmer.bankDetails;

      let unit = null;
      let officialRatePerUnit = null;
      let estimatedValue = null;
      if (crop && plannedQuantity) {
        const rate = await CropRate.findOne({ crop }).session(session);
        if (rate) {
          unit = rate.unit;
          officialRatePerUnit = rate.ratePerUnit;
          estimatedValue = Number((plannedQuantity * rate.ratePerUnit).toFixed(2));
        }
      }

      slot.bookedCount += 1;
      await slot.save({ session });

      // Daily queue number: 1st, 2nd, 3rd... farmer to book at THIS centre
      // on THIS date, counted across all slots - not per-slot. Computed
      // inside the same transaction so two simultaneous bookings at the
      // same centre can't both land on the same number.
      const priorBookingsToday = await Booking.countDocuments({ centre: slot.centre, date: slot.date }).session(session);
      const dailyQueueNumber = priorBookingsToday + 1;

      const token = await buildToken({
        centre,
        date: slot.date,
        crop,
        slotId: slot._id,
        dailyQueueNumber,
      });

      const [booking] = await Booking.create(
        [
          {
            token,
            farmer: farmer._id,
            centre: slot.centre,
            slot: slot._id,
            date: slot.date,
            startTime: slot.startTime,
            endTime: slot.endTime,
            channel,
            crop,
            unit,
            plannedQuantity: plannedQuantity || null,
            officialRatePerUnit,
            estimatedValue,
            dailyQueueNumber,
            bankSnapshot: effectiveBank?.accountNumber
              ? {
                  accountHolderName: effectiveBank.accountHolderName,
                  bankName: effectiveBank.bankName,
                  accountNumberLast4: maskAccountNumber(effectiveBank.accountNumber),
                  ifscCode: effectiveBank.ifscCode,
                }
              : undefined,
            paymentStatus: 'pending',
          },
        ],
        { session }
      );

      result = { booking, farmer, slot, centre };
    });

    const io = req.app.get('io');
    await broadcastEvent(io, {
      farmer: result.farmer._id,
      event: 'booking_confirmed',
      templates: {
        sms: `Booking confirmed. Token ${result.booking.token} at ${result.centre.name}, ${result.booking.date} ${result.booking.startTime}-${result.booking.endTime}.`,
        whatsapp: `Your procurement slot is confirmed for ${result.booking.startTime}-${result.booking.endTime} on ${result.booking.date} at ${result.centre.name}. Token: ${result.booking.token}.`,
      },
    });

    res.status(201).json(result.booking);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Booking failed' });
  } finally {
    session.endSession();
  }
}

// PUT /api/bookings/:id/reschedule  { slotId }
// Moves a still-waiting booking to a different slot (same centre, same or
// different date) - used when the farmer is shown a lower-queue slot and
// opts to switch. The token is regenerated because it encodes the slot
// number and queue position, both of which change.
async function rescheduleBooking(req, res) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const { slotId } = req.body;
      if (!slotId) throw Object.assign(new Error('slotId is required'), { status: 400 });

      const booking = await Booking.findById(req.params.id).session(session);
      if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 });
      if (booking.queueStatus !== 'waiting' || booking.procurementStage !== 'booked') {
        throw Object.assign(new Error('This booking can no longer be rescheduled'), { status: 409 });
      }

      const newSlot = await Slot.findById(slotId).session(session);
      if (!newSlot) throw Object.assign(new Error('Slot not found'), { status: 404 });
      if (String(newSlot.centre) !== String(booking.centre)) {
        throw Object.assign(new Error('Can only reschedule within the same centre'), { status: 400 });
      }
      if (newSlot.isClosed || newSlot.bookedCount >= newSlot.capacity) {
        throw Object.assign(new Error('That slot is no longer available'), { status: 409 });
      }

      const oldSlot = await Slot.findById(booking.slot).session(session);
      if (oldSlot) {
        oldSlot.bookedCount = Math.max(0, oldSlot.bookedCount - 1);
        await oldSlot.save({ session });
      }

      newSlot.bookedCount += 1;
      await newSlot.save({ session });

      const centre = await Centre.findById(booking.centre).session(session);
      // The slot changes, but the farmer's daily queue position at this
      // centre does not - it reflects when they originally booked that day,
      // not which slot they're currently in. If the date itself changes
      // (not offered by the current UI, but guarded here anyway), the old
      // number could collide with another farmer already holding it on the
      // new date, so recompute fresh in that case.
      let { dailyQueueNumber } = booking;
      if (newSlot.date !== booking.date) {
        const priorBookingsThatDay = await Booking.countDocuments({
          centre: booking.centre,
          date: newSlot.date,
          _id: { $ne: booking._id },
        }).session(session);
        dailyQueueNumber = priorBookingsThatDay + 1;
      }

      const token = await buildToken({
        centre,
        date: newSlot.date,
        crop: booking.crop,
        slotId: newSlot._id,
        dailyQueueNumber,
      });

      booking.slot = newSlot._id;
      booking.date = newSlot.date;
      booking.startTime = newSlot.startTime;
      booking.endTime = newSlot.endTime;
      booking.dailyQueueNumber = dailyQueueNumber;
      booking.token = token;
      await booking.save({ session });

      result = booking;
    });

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Reschedule failed' });
  } finally {
    session.endSession();
  }
}

// GET /api/bookings/token/:token
async function getBookingByToken(req, res) {
  try {
    const booking = await Booking.findOne({ token: req.params.token })
      .populate('centre', 'name district codePrefix')
      .populate('farmer', 'name mobileNumber preferredLanguage');
    if (!booking) return res.status(404).json({ message: 'Token not found' });

    const queueInfo = await computeQueueInfo(booking);
    res.json({ booking, queue: queueInfo, estimatedPaymentDate: estimatedPaymentDateFor(booking) });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch booking', error: err.message });
  }
}

// GET /api/bookings/farmer/:farmerId
async function getBookingsForFarmer(req, res) {
  try {
    const bookings = await Booking.find({ farmer: req.params.farmerId })
      .populate('centre', 'name district codePrefix')
      .sort({ createdAt: -1 });
    const withEstimates = bookings.map((b) => ({
      ...b.toObject(),
      estimatedPaymentDate: estimatedPaymentDateFor(b),
    }));
    res.json(withEstimates);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch bookings', error: err.message });
  }
}

// Shared helper: how many farmers are ahead of this booking in its slot's
// queue, and a simple estimated wait based on average handling time.
async function computeQueueInfo(booking, avgMinutesPerFarmer = 5) {
  if (booking.queueStatus === 'completed' || booking.queueStatus === 'cancelled') {
    return { aheadCount: 0, estimatedWaitMinutes: 0, currentlyProcessing: null };
  }

  const ahead = await Booking.countDocuments({
    slot: booking.slot,
    queueStatus: 'waiting',
    createdAt: { $lt: booking.createdAt },
  });

  const processing = await Booking.findOne({
    slot: booking.slot,
    queueStatus: 'processing',
  }).select('token');

  return {
    aheadCount: ahead,
    estimatedWaitMinutes: ahead * avgMinutesPerFarmer,
    currentlyProcessing: processing ? processing.token : null,
  };
}

// Simulated, clearly-labelled ETA rather than a real disbursal schedule:
// PAYMENT_ETA_DAYS after procurement completed (or after booking if not
// yet completed), and null once actually paid.
function estimatedPaymentDateFor(booking) {
  if (booking.paymentStatus === 'completed') return null;
  const base = booking.completedAt || booking.createdAt;
  const eta = new Date(base);
  eta.setDate(eta.getDate() + PAYMENT_ETA_DAYS);
  return eta.toISOString().slice(0, 10);
}

module.exports = {
  createBooking,
  rescheduleBooking,
  getBookingByToken,
  getBookingsForFarmer,
  computeQueueInfo,
  estimatedPaymentDateFor,
};
