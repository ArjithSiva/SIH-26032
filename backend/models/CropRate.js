const mongoose = require('mongoose');

// Admin-configured official procurement rate per crop, so prices are never
// hardcoded into application logic and can be updated as government rates change.
// Rates are quoted per `unit` (e.g. "bag") rather than always per kg, since
// that's how farmers here actually describe quantity - `unitWeightKg` is an
// optional reference conversion (e.g. a bag is nominally 50kg) for anyone
// who needs a kg figure, but is never required for booking or payment maths.
const cropRateSchema = new mongoose.Schema(
  {
    crop: { type: String, required: true, unique: true, trim: true },
    unit: { type: String, trim: true, default: 'bag' },
    ratePerUnit: { type: Number, required: true },
    unitWeightKg: { type: Number, default: null },
    state: { type: String, default: 'Tamil Nadu' },
    effectiveFrom: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CropRate', cropRateSchema);
