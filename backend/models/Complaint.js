const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema(
  {
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true },
    centre: { type: mongoose.Schema.Types.ObjectId, ref: 'Centre', required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null }, // optional - which visit it's about
    category: {
      type: String,
      enum: ['long_wait', 'rude_behaviour', 'wrong_weight', 'payment_delay', 'other'],
      default: 'other',
    },
    message: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved'],
      default: 'open',
    },
    adminNote: { type: String, trim: true, default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Complaint', complaintSchema);
