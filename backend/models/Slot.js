const mongoose = require('mongoose');

// A Slot represents one bookable window (e.g. 10-11 AM) at one centre on one date.
// Slots are generated on demand from the centre's operating parameters rather
// than being hand-created, so changing a centre's hours/capacity doesn't
// require rewriting historical data.
const slotSchema = new mongoose.Schema(
  {
    centre: { type: mongoose.Schema.Types.ObjectId, ref: 'Centre', required: true },
    date: { type: String, required: true }, // "YYYY-MM-DD"
    startTime: { type: String, required: true }, // "HH:mm"
    endTime: { type: String, required: true },
    capacity: { type: Number, required: true },
    bookedCount: { type: Number, default: 0 },
    isClosed: { type: Boolean, default: false }, // manually closed by officer/admin
  },
  { timestamps: true }
);

slotSchema.index({ centre: 1, date: 1, startTime: 1 }, { unique: true });

slotSchema.virtual('status').get(function status() {
  if (this.isClosed) return 'closed';
  return this.bookedCount >= this.capacity ? 'full' : 'available';
});

slotSchema.virtual('remaining').get(function remaining() {
  return Math.max(this.capacity - this.bookedCount, 0);
});

slotSchema.set('toJSON', { virtuals: true });
slotSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Slot', slotSchema);
