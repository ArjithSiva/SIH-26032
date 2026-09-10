const express = require('express');
const {
  fileComplaint,
  getComplaintsForFarmer,
  listComplaints,
  updateComplaint,
} = require('../controllers/complaintController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/', requireAuth(['farmer']), fileComplaint);
router.get('/farmer/:farmerId', requireAuth(['farmer', 'admin']), getComplaintsForFarmer);
router.get('/', requireAuth(['admin']), listComplaints);
router.put('/:id', requireAuth(['admin']), updateComplaint);

module.exports = router;
