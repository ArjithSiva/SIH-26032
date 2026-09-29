const Notification = require('../models/Notification');
const { assertOfficerOwnsCentre } = require('../middleware/auth');

// A farmer may only view/clear their own notifications; staff can view on a
// farmer's behalf. Mirrors the same canAct() pattern used in
// farmerController/complaintController.
function canActAsFarmer(req, farmerId) {
  if (!req.user) return false;
  if (req.user.role === 'farmer') return req.user.id === farmerId;
  return req.user.role === 'officer' || req.user.role === 'admin';
}

// GET /api/notifications/farmer/:farmerId
// Previously had NO auth middleware at all - anyone, signed in or not,
// could pull any farmer's full notification history (which includes
// booking tokens, payment amounts, and other SMS/push content) just by
// knowing or guessing their Mongo id. Now requires a session and, for a
// farmer caller, ownership of that id.
async function getFarmerNotifications(req, res) {
  try {
    if (!canActAsFarmer(req, req.params.farmerId)) return res.status(403).json({ message: 'Not authorised' });
    const notifications = await Notification.find({ recipientRole: 'farmer', farmer: req.params.farmerId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch notifications', error: err.message });
  }
}

// DELETE /api/notifications/farmer/:farmerId
// The farmer's own "Clear" action - previously there was no way to clear a
// notification centre at all, farmer or otherwise.
async function clearFarmerNotifications(req, res) {
  try {
    if (!canActAsFarmer(req, req.params.farmerId)) return res.status(403).json({ message: 'Not authorised' });
    await Notification.deleteMany({ recipientRole: 'farmer', farmer: req.params.farmerId });
    res.json({ message: 'Notifications cleared' });
  } catch (err) {
    res.status(500).json({ message: 'Could not clear notifications', error: err.message });
  }
}

// GET /api/notifications/centre/:centreId
// The officer/procurement-centre notification centre - e.g. "payment
// processed and received" receipts once a farmer's payment completes.
async function getCentreNotifications(req, res) {
  try {
    assertOfficerOwnsCentre(req, req.params.centreId);
    const notifications = await Notification.find({ recipientRole: 'officer', centre: req.params.centreId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Could not fetch notifications' });
  }
}

// DELETE /api/notifications/centre/:centreId
async function clearCentreNotifications(req, res) {
  try {
    assertOfficerOwnsCentre(req, req.params.centreId);
    await Notification.deleteMany({ recipientRole: 'officer', centre: req.params.centreId });
    res.json({ message: 'Notifications cleared' });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Could not clear notifications' });
  }
}

// GET /api/notifications/admin
// A shared inbox across all admin accounts (the rest of the admin panel -
// e.g. stats-overview - isn't split per-admin either), for things like
// "a payment request was just sent to the government and needs processing".
async function getAdminNotifications(req, res) {
  try {
    const notifications = await Notification.find({ recipientRole: 'admin' })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch notifications', error: err.message });
  }
}

// DELETE /api/notifications/admin
async function clearAdminNotifications(req, res) {
  try {
    await Notification.deleteMany({ recipientRole: 'admin' });
    res.json({ message: 'Notifications cleared' });
  } catch (err) {
    res.status(500).json({ message: 'Could not clear notifications', error: err.message });
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

module.exports = {
  getFarmerNotifications,
  clearFarmerNotifications,
  getCentreNotifications,
  clearCentreNotifications,
  getAdminNotifications,
  clearAdminNotifications,
  getRecentFeed,
};
