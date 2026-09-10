const mongoose = require('mongoose');

// Every "sent" SMS / WhatsApp / push / IVR-voice message is written here
// instead of going to a real telecom provider. The frontend's Notification
// Simulator panel reads this collection (and listens for it over Socket.IO)
// so judges/testers can see exactly what a farmer would have received.
const notificationSchema = new mongoose.Schema(
  {
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true },
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
