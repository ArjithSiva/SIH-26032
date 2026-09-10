// Keeps real-time wiring in one place: farmers join a room keyed to their
// own id so notificationSimulator.js can target them directly, and everyone
// implicitly receives the global 'notification:feed' event used by the
// demo-wide Notification Simulator panel.
function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    socket.on('join:farmer', (farmerId) => {
      if (farmerId) socket.join(`farmer:${farmerId}`);
    });

    socket.on('join:centre', (centreId) => {
      if (centreId) socket.join(`centre:${centreId}`);
    });
  });
}

module.exports = registerSocketHandlers;
