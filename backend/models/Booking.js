const mongoose = require('mongoose');

const PROCUREMENT_STAGES = [
  'booked',
  'checked_in',
  'weighing',
  'quality_verification',
  'procurement_completed',
  'payment_processing',
  'payment_completed',
];

const bookingSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true }, // e.g. "TNJ-014-20260908-PADDY-S3-Q05"
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true },
    centre: { type: mongoose.Schema.Types.ObjectId, ref: 'Centre', required: true },
    slot: { type: mongoose.Schema.Types.ObjectId, ref: 'Slot', required: true },
    date: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },

    channel: { type: String, enum: ['web', 'ivr'], default: 'web' },

    // Queue position bookkeeping. queuePosition is recalculated among
    // bookings in the same slot whenever the queue advances.
    queueStatus: {
      type: String,
      enum: ['waiting', 'processing', 'completed', 'absent', 'cancelled'],
      default: 'waiting',
    },

    procurementStage: {
      type: String,
      enum: PROCUREMENT_STAGES,
      default: 'booked',
    },

    crop: { type: String, trim: true },
    // Unit the crop was measured in at booking time (e.g. "bag") - copied
    // from CropRate.unit so this booking's figures stay meaningful even if
    // an admin later changes that crop's unit.
    unit: { type: String, trim: true, default: null },
    // What the farmer told the system at booking time, before anything is
    // physically weighed/counted - used to show the government minimum-
    // price estimate up front. quantity (below) is the officer's actual
    // counted figure recorded later at the weighing stage and is what the
    // real payment is based on.
    plannedQuantity: { type: Number, default: null },
    quantity: { type: Number, default: null },
    officialRatePerUnit: { type: Number, default: null },
    estimatedValue: { type: Number, default: null },

    // The farmer's 1-based position among ALL bookings made at this centre
    // on this date, regardless of which slot - this is the final "Q"
    // segment of the token, and it's what has to start at 1 each new day
    // per centre. Stored (not recomputed) so a later reschedule to a
    // different slot on the same day doesn't reshuffle it.
    dailyQueueNumber: { type: Number, default: null },

    // Snapshot of the farmer's bank details at the moment of this booking,
    // so a later change to the farmer's saved bank details doesn't rewrite
    // where a past payment says it was sent. accountNumber is masked to
    // its last 4 digits here for anything read back to the UI; the full
    // number lives only on the Farmer profile.
    bankSnapshot: {
      accountHolderName: { type: String, trim: true, default: null },
      bankName: { type: String, trim: true, default: null },
      accountNumberLast4: { type: String, trim: true, default: null },
      ifscCode: { type: String, trim: true, default: null },
    },

    paymentStatus: {
      type: String,
      enum: ['not_applicable', 'pending', 'processing', 'completed'],
      default: 'not_applicable',
    },
    paidAmount: { type: Number, default: null },
    paidAt: { type: Date, default: null },

    calledAt: { type: Date, default: null },
    checkedInAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

bookingSchema.statics.PROCUREMENT_STAGES = PROCUREMENT_STAGES;

module.exports = mongoose.model('Booking', bookingSchema);
