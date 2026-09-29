const mongoose = require('mongoose');

// Officers and admins are kept separate from Farmer: they log in with a
// username/password (not OTP-by-mobile), since they're operating from a
// fixed desk at a centre rather than calling in from the field.
const staffSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['officer', 'admin'], required: true },
    centre: { type: mongoose.Schema.Types.ObjectId, ref: 'Centre', default: null }, // null for admin
    // Nudges the admin to move off the seeded default password (which is a
    // well-known, easily-breached string) - cleared once they set their own.
    mustChangePassword: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Staff', staffSchema);
