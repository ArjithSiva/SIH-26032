const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Farmer = require('../models/Farmer');
const Staff = require('../models/Staff');
const Centre = require('../models/Centre');
const { issueOTP, verifyOTP } = require('../utils/otpSimulator');

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// --- Farmer: register (step 1 of the wizard - just name + mobile + gender/DOB).
// Location, KYC and preferred centres are filled in afterwards via the
// authenticated /api/farmers/:id/* endpoints once the mobile OTP below is
// verified, so an incomplete wizard still leaves a valid, resumable account. ---
async function registerFarmer(req, res) {
  try {
    const { name, mobileNumber, gender, dateOfBirth, preferredLanguage } = req.body;
    if (!name || !mobileNumber) {
      return res.status(400).json({ message: 'name and mobileNumber are required' });
    }

    const existing = await Farmer.findOne({ mobileNumber });
    if (existing) {
      return res.status(409).json({ message: 'A farmer with this mobile number already exists' });
    }

    const farmer = await Farmer.create({
      name,
      mobileNumber,
      gender: gender || null,
      dateOfBirth: dateOfBirth || null,
      preferredLanguage: preferredLanguage || 'ta',
      registeredVia: 'web',
    });

    const otp = await issueOTP(mobileNumber, 'register');
    res.status(201).json({
      message: 'Farmer registered. Verify mobile number with the OTP to continue.',
      farmerId: farmer._id,
      ...otp,
    });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
}

// --- Farmer: request an OTP for login (also used by the IVR simulator) ---
async function requestOTP(req, res) {
  try {
    const { mobileNumber } = req.body;
    if (!mobileNumber) return res.status(400).json({ message: 'mobileNumber is required' });

    const farmer = await Farmer.findOne({ mobileNumber });
    if (!farmer) return res.status(404).json({ message: 'No farmer registered with this number' });

    const otp = await issueOTP(mobileNumber, 'login');
    res.json({ message: 'OTP issued', ...otp });
  } catch (err) {
    res.status(500).json({ message: 'Could not issue OTP', error: err.message });
  }
}

// --- Farmer: verify OTP and receive a session token ---
async function verifyFarmerOTP(req, res) {
  try {
    const { mobileNumber, code } = req.body;
    if (!mobileNumber || !code) {
      return res.status(400).json({ message: 'mobileNumber and code are required' });
    }

    const result = await verifyOTP(mobileNumber, code);
    if (!result.valid) return res.status(401).json({ message: result.reason });

    const farmer = await Farmer.findOne({ mobileNumber }).populate('preferredCentres', 'name district taluk village codePrefix');
    if (!farmer) return res.status(404).json({ message: 'Farmer not found' });

    const token = signToken({ id: farmer._id, role: 'farmer', mobileNumber });
    res.json({ token, farmer });
  } catch (err) {
    res.status(500).json({ message: 'OTP verification failed', error: err.message });
  }
}

// --- Staff (officer/admin): username + password login ---
async function staffLogin(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'username and password are required' });
    }

    const staff = await Staff.findOne({ username, isActive: true }).select('+passwordHash');
    if (!staff) return res.status(401).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, staff.passwordHash);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const token = signToken({
      id: staff._id,
      role: staff.role,
      centre: staff.centre,
      name: staff.name,
    });

    res.json({
      token,
      staff: { id: staff._id, name: staff.name, role: staff.role, centre: staff.centre, mustChangePassword: staff.mustChangePassword },
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
}

// --- Staff (admin): change their own password. The seeded default
// (admin123) is a well-known string that password managers will flag as
// breached - this is how an admin moves off it. ---
async function changeStaffPassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'currentPassword and newPassword are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }

    const staff = await Staff.findById(req.user.id).select('+passwordHash');
    if (!staff) return res.status(404).json({ message: 'Account not found' });

    const match = await bcrypt.compare(currentPassword, staff.passwordHash);
    if (!match) return res.status(401).json({ message: 'Current password is incorrect' });

    staff.passwordHash = await bcrypt.hash(newPassword, 10);
    staff.mustChangePassword = false;
    await staff.save();

    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ message: 'Could not change password', error: err.message });
  }
}

// --- Officer: log in by picking their centre from a search list, plus that
// centre's own password (see Centre.officerPasswordHash) - no per-officer
// Staff account is needed, the centre itself is the identity. ---
async function officerLogin(req, res) {
  try {
    const { centreId, password } = req.body;
    if (!centreId || !password) {
      return res.status(400).json({ message: 'centreId and password are required' });
    }

    const centre = await Centre.findById(centreId).select('+officerPasswordHash');
    if (!centre || !centre.isActive) {
      return res.status(404).json({ message: 'Centre not found' });
    }
    if (!centre.officerPasswordHash) {
      return res.status(500).json({ message: 'This centre has no password set yet - contact the state admin' });
    }

    const match = await bcrypt.compare(password, centre.officerPasswordHash);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const token = signToken({ id: centre._id, role: 'officer', centre: centre._id, name: centre.name });
    res.json({
      token,
      staff: {
        id: centre._id,
        name: centre.officerName || centre.name,
        role: 'officer',
        centre: centre._id,
        centreName: centre.name,
        mustChangePassword: centre.mustChangeOfficerPassword,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
}

// --- IVR: identify a farmer by their calling number, no OTP needed for basic lookup ---
async function lookupFarmerByMobile(req, res) {
  try {
    const { mobileNumber } = req.query;
    if (!mobileNumber) return res.status(400).json({ message: 'mobileNumber is required' });

    const farmer = await Farmer.findOne({ mobileNumber }).select('name mobileNumber preferredLanguage');
    if (!farmer) return res.status(404).json({ message: 'Number not registered' });

    res.json(farmer);
  } catch (err) {
    res.status(500).json({ message: 'Lookup failed', error: err.message });
  }
}

module.exports = {
  registerFarmer,
  requestOTP,
  verifyFarmerOTP,
  staffLogin,
  changeStaffPassword,
  officerLogin,
  lookupFarmerByMobile,
};
