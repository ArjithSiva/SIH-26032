const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    mobileNumber: { type: String, required: true },
    code: { type: String, required: true },
    purpose: { type: String, enum: ['register', 'login', 'aadhar'], default: 'login' },
    expiresAt: { type: Date, required: true },
    consumed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Auto-delete expired OTP docs so the collection doesn't grow forever.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OTP', otpSchema);
