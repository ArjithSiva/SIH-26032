const express = require('express');
const { getSlotsForDate, getUpcomingDates } = require('../controllers/slotController');

const router = express.Router();

router.get('/', getSlotsForDate);
router.get('/upcoming-dates', getUpcomingDates);

module.exports = router;
