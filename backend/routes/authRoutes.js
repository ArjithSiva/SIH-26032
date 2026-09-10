const express = require('express');
const {
  registerFarmer,
  requestOTP,
  verifyFarmerOTP,
  staffLogin,
  changeStaffPassword,
  officerLogin,
  lookupFarmerByMobile,
} = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/farmer/register', registerFarmer);
router.post('/farmer/request-otp', requestOTP);
router.post('/farmer/verify-otp', verifyFarmerOTP);
router.get('/farmer/lookup', lookupFarmerByMobile);
router.post('/staff/login', staffLogin);
router.post('/staff/change-password', requireAuth(['admin']), changeStaffPassword);
router.post('/officer/login', officerLogin);

module.exports = router;
