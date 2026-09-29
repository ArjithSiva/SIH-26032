const express = require('express');
const {
  getFarmerNotifications,
  clearFarmerNotifications,
  getCentreNotifications,
  clearCentreNotifications,
  getAdminNotifications,
  clearAdminNotifications,
  getRecentFeed,
} = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/farmer/:farmerId', requireAuth(['farmer', 'officer', 'admin']), getFarmerNotifications);
router.delete('/farmer/:farmerId', requireAuth(['farmer', 'officer', 'admin']), clearFarmerNotifications);

router.get('/centre/:centreId', requireAuth(['officer', 'admin']), getCentreNotifications);
router.delete('/centre/:centreId', requireAuth(['officer', 'admin']), clearCentreNotifications);

router.get('/admin', requireAuth(['admin']), getAdminNotifications);
router.delete('/admin', requireAuth(['admin']), clearAdminNotifications);

// /feed is intentionally public/unauthenticated - it's the unscoped demo-wide
// Notification Simulator panel (see notificationController.js), not
// farmer-specific data.
router.get('/feed', getRecentFeed);

module.exports = router;
