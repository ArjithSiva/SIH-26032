const express = require('express');
const {
  createBooking,
  rescheduleBooking,
  cancelBooking,
  getBookingByToken,
  getBookingsForFarmer,
} = require('../controllers/bookingController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/', createBooking);
router.put('/:id/reschedule', requireAuth(['farmer']), rescheduleBooking);
router.delete('/:id/cancel', requireAuth(['farmer']), cancelBooking);
router.get('/token/:token', getBookingByToken);
router.get('/farmer/:farmerId', getBookingsForFarmer);

module.exports = router;
