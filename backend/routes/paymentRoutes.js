const express = require('express');
const { getPaymentRequests, requestPayment, processPayment, completePayment } = require('../controllers/paymentController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Admin's queue of requests awaiting review/already-in-progress.
router.get('/requests', requireAuth(['admin']), getPaymentRequests);

// The officer's only payment action now: send it to admin. Processing and
// completing are admin-only - see paymentController.js for why.
router.post('/:bookingId/request', requireAuth(['officer', 'admin']), requestPayment);
router.post('/:bookingId/process', requireAuth(['admin']), processPayment);
router.post('/:bookingId/complete', requireAuth(['admin']), completePayment);

module.exports = router;
