const mongoose = require('mongoose');

// Every "sent" SMS / WhatsApp / push / IVR-voice message is written here
// instead of going to a real telecom provider. The frontend's Notification
// Simulator panel reads this collection (and listens for it over Socket.IO)
// so judges/testers can see exactly what a farmer would have received.
//
// recipientRole generalizes this beyond farmers: a payment-processing
// request now needs to reach the admin, and a payment-completed receipt
// needs to reach the procurement centre (officer) as well as the farmer.
// farmer/centre are each required only for the role they apply to - kept
// optional at the schema level (rather than two separate collections) so
// existing farmer-only documents and code stay valid unchanged.
const notificationSchema = new mongoose.Schema(
  {
    recipientRole: {
      type: String,
      enum: ['farmer', 'officer', 'admin'],
      required: true,
      default: 'farmer',
    },
    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Farmer',
      required: [function requiredForFarmer() { return this.recipientRole === 'farmer'; }, 'farmer is required when recipientRole is "farmer"'],
    },
    // Which centre this is for, when recipientRole is 'officer' - an
    // officer's dashboard queries by their own centre, same as everywhere
    // else in the app.
    centre: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Centre',
      required: [function requiredForOfficer() { return this.recipientRole === 'officer'; }, 'centre is required when recipientRole is "officer"'],
    },
    channel: {
      type: String,
      enum: ['sms', 'whatsapp', 'push', 'ivr_voice'],
      required: true,
    },
    event: { type: String, required: true }, // e.g. "booking_confirmed", "queue_approaching"
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
