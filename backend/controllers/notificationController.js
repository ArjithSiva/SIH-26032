const Notification = require('../models/Notification');

// GET /api/notifications/farmer/:farmerId
async function getFarmerNotifications(req, res) {
  try {
    const notifications = await Notification.find({ farmer: req.params.farmerId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch notifications', error: err.message });
  }
}

// GET /api/notifications/feed
// Unscoped recent feed, used by the demo-wide Notification Simulator panel
// so judges can watch every channel firing as actions happen anywhere in the app.
async function getRecentFeed(req, res) {
  try {
    const notifications = await Notification.find()
      .populate('farmer', 'name mobileNumber')
      .sort({ createdAt: -1 })
      .limit(30);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch feed', error: err.message });
  }
}

module.exports = { getFarmerNotifications, getRecentFeed };
