const Notification = require('../models/Notification');

/**
 * Records a notification exactly as a real SMS/WhatsApp/push send would,
 * then emits it over Socket.IO so the frontend's Notification Simulator
 * panel updates live. Swapping this for a real provider later only means
 * calling the provider's API here in addition to (or instead of) the
 * Notification.create - no caller of sendNotification needs to change.
 */
async function sendNotification(io, { farmer, channel, event, message }) {
  const notification = await Notification.create({ farmer, channel, event, message });

  if (io) {
    io.to(`farmer:${farmer}`).emit('notification:new', notification);
    io.emit('notification:feed', notification); // for the demo-wide simulator panel
  }

  return notification;
}

/**
 * Fans a single event out across the channels the brief lists (SMS,
 * WhatsApp, push). Each channel gets its own row/message so the simulator
 * panel can show all three "arriving" the way a farmer would actually see them.
 */
async function broadcastEvent(io, { farmer, event, templates }) {
  const channels = Object.keys(templates);
  const results = await Promise.all(
    channels.map((channel) =>
      sendNotification(io, { farmer, channel, event, message: templates[channel] })
    )
  );
  return results;
}

module.exports = { sendNotification, broadcastEvent };
