const Notification = require('../models/Notification');

/**
 * Records a notification exactly as a real SMS/WhatsApp/push send would,
 * then emits it over Socket.IO so the frontend's Notification Simulator
 * panel updates live. Swapping this for a real provider later only means
 * calling the provider's API here in addition to (or instead of) the
 * Notification.create - no caller of sendNotification needs to change.
 *
 * recipientRole picks who this is for and which room it's pushed to:
 *   'farmer'  (default) - requires `farmer`, pushed to `farmer:<id>`
 *   'officer' - requires `centre`, pushed to `centre:<id>` (the same room
 *               queue:update already uses, so one officer dashboard
 *               subscription covers both)
 *   'admin'   - pushed to the shared `admin` room (all signed-in admins)
 */
async function sendNotification(io, { recipientRole = 'farmer', farmer, centre, channel, event, message }) {
  const notification = await Notification.create({
    recipientRole,
    farmer: recipientRole === 'farmer' ? farmer : undefined,
    centre: recipientRole === 'officer' ? centre : undefined,
    channel,
    event,
    message,
  });

  if (io) {
    if (recipientRole === 'farmer') {
      io.to(`farmer:${farmer}`).emit('notification:new', notification);
    } else if (recipientRole === 'officer') {
      io.to(`centre:${centre}`).emit('notification:new', notification);
    } else if (recipientRole === 'admin') {
      io.to('admin').emit('notification:new', notification);
    }
    io.emit('notification:feed', notification); // for the demo-wide simulator panel
  }

  return notification;
}

/**
 * Fans a single event out across the channels the brief lists (SMS,
 * WhatsApp, push). Each channel gets its own row/message so the simulator
 * panel can show all three "arriving" the way a farmer would actually see them.
 */
async function broadcastEvent(io, { recipientRole = 'farmer', farmer, centre, event, templates }) {
  const channels = Object.keys(templates);
  const results = await Promise.all(
    channels.map((channel) =>
      sendNotification(io, { recipientRole, farmer, centre, channel, event, message: templates[channel] })
    )
  );
  return results;
}

module.exports = { sendNotification, broadcastEvent };
