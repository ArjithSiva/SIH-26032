const express = require('express');
const { getCentreQueue, checkIn, callNext, markAbsent } = require('../controllers/queueController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/centre/:centreId/date/:date', requireAuth(['officer', 'admin']), getCentreQueue);
router.post('/:bookingId/check-in', requireAuth(['officer', 'admin']), checkIn);
router.post('/:bookingId/call-next', requireAuth(['officer', 'admin']), callNext);
router.post('/:bookingId/mark-absent', requireAuth(['officer', 'admin']), markAbsent);

module.exports = router;
