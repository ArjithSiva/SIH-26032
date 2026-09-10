const express = require('express');
const { getFarmerNotifications, getRecentFeed } = require('../controllers/notificationController');

const router = express.Router();

router.get('/farmer/:farmerId', getFarmerNotifications);
router.get('/feed', getRecentFeed);

module.exports = router;
