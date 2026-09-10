const express = require('express');
const {
  getFarmer,
  updateLocation,
  updatePersonalDetails,
  submitAadhar,
  submitLandRecords,
  requestAadharOtp,
  verifyAadharOtp,
  acceptPolicy,
  updatePreferredCentres,
  updateBankDetails,
} = require('../controllers/farmerController');
const { requireAuth } = require('../middleware/auth');
const { handleLeaseDocumentUpload } = require('../middleware/upload');

const router = express.Router();

router.get('/:id', requireAuth(['farmer', 'officer', 'admin']), getFarmer);
router.put('/:id/location', requireAuth(['farmer', 'officer', 'admin']), updateLocation);
router.put('/:id/personal', requireAuth(['farmer', 'officer', 'admin']), updatePersonalDetails);
router.put('/:id/aadhar', requireAuth(['farmer', 'officer', 'admin']), submitAadhar);
router.put('/:id/land-records', requireAuth(['farmer', 'officer', 'admin']), handleLeaseDocumentUpload, submitLandRecords);
router.post('/:id/kyc/request-otp', requireAuth(['farmer', 'officer', 'admin']), requestAadharOtp);
router.post('/:id/kyc/verify-otp', requireAuth(['farmer', 'officer', 'admin']), verifyAadharOtp);
router.put('/:id/policy', requireAuth(['farmer', 'officer', 'admin']), acceptPolicy);
router.put('/:id/preferred-centres', requireAuth(['farmer', 'officer', 'admin']), updatePreferredCentres);
router.put('/:id/bank-details', requireAuth(['farmer', 'officer', 'admin']), updateBankDetails);

module.exports = router;
