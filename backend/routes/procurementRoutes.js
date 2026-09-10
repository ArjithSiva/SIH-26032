const express = require('express');
const { updateStage, recordQuantity } = require('../controllers/procurementController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/:bookingId/stage', requireAuth(['officer', 'admin']), updateStage);
router.post('/:bookingId/quantity', requireAuth(['officer', 'admin']), recordQuantity);

module.exports = router;
