const express = require('express');
const { updatePaymentStatus } = require('../controllers/paymentController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/:bookingId', requireAuth(['officer', 'admin']), updatePaymentStatus);

module.exports = router;
