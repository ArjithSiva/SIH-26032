const express = require('express');
const {
  listCropRates,
  upsertCropRate,
  updateCropRate,
  createStaff,
  listStaff,
  getStatsOverview,
} = require('../controllers/adminController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/crop-rates', listCropRates);
router.post('/crop-rates', requireAuth(['admin']), upsertCropRate);
router.put('/crop-rates/:id', requireAuth(['admin']), updateCropRate);
router.post('/staff', requireAuth(['admin']), createStaff);
router.get('/staff', requireAuth(['admin']), listStaff);
router.get('/stats-overview', requireAuth(['admin']), getStatsOverview);

module.exports = router;
