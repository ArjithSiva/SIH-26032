const Farmer = require('../models/Farmer');
const Centre = require('../models/Centre');
const { issueOTP, verifyOTP } = require('../utils/otpSimulator');

// A farmer may only edit their own profile; staff (officer/admin) can view
// or edit on a farmer's behalf, matching the brief's "registered through an
// authorised registration point" model.
function canAct(req, farmerId) {
  if (!req.user) return false;
  if (req.user.role === 'farmer') return req.user.id === farmerId;
  return req.user.role === 'officer' || req.user.role === 'admin';
}

// GET /api/farmers/:id
async function getFarmer(req, res) {
  try {
    if (!canAct(req, req.params.id)) return res.status(403).json({ message: 'Not authorised' });
    const farmer = await Farmer.findById(req.params.id).populate('preferredCentres', 'name district taluk village codePrefix');
    if (!farmer) return res.status(404).json({ message: 'Farmer not found' });
    res.json(farmer);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch farmer', error: err.message });
  }
}

// PUT /api/farmers/:id/location  { state, district, taluk, village, pincode }
async function updateLocation(req, res) {
  try {
    if (!canAct(req, req.params.id)) return res.status(403).json({ message: 'Not authorised' });
    const { state, district, taluk, village, pincode } = req.body;
    if (!district || !taluk || !village) {
      return res.status(400).json({ message: 'district, taluk and village are required' });
    }
    if (!pincode || !/^[0-9]{6}$/.test(pincode)) {
      return res.status(400).json({ message: 'pincode must be exactly 6 digits' });
    }

    const farmer = await Farmer.findByIdAndUpdate(
      req.params.id,
      { state: state || 'Tamil Nadu', district, taluk, village, pincode },
      { new: true, runValidators: true }
    );
    if (!farmer) return res.status(404).json({ message: 'Farmer not found' });
    res.json(farmer);
  } catch (err) {
    res.status(400).json({ message: 'Could not update location', error: err.message });
  }
}

// PUT /api/farmers/:id/aadhar  { aadharNumber }
// Its own page/step now, separate from land records - verification of the
// Aadhar number itself happens via the OTP endpoints below, matching "for
// now let them enter the digits and use a mock OTP".
async function submitAadhar(req, res) {
  try {
    if (!canAct(req, req.params.id)) return res.status(403).json({ message: 'Not authorised' });
    const { aadharNumber } = req.body;
    if (!aadharNumber || !/^[0-9]{12}$/.test(aadharNumber)) {
      return res.status(400).json({ message: 'aadharNumber must be exactly 12 digits' });
    }

    const existing = await Farmer.findById(req.params.id).select('aadharNumber aadharVerified');
    if (!existing) return res.status(404).json({ message: 'Farmer not found' });

    // Only re-require verification if the number actually changed - so
    // re-submitting the same, already-verified number (e.g. navigating
    // back through the wizard) doesn't undo the OTP check.
    const update = { aadharNumber };
    if (existing.aadharNumber !== aadharNumber) update.aadharVerified = false;

    const farmer = await Farmer.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    res.json(farmer);
  } catch (err) {
    res.status(400).json({ message: 'Could not save Aadhar number', error: err.message });
  }
}

// PUT /api/farmers/:id/land-records
// multipart/form-data: { landDistrict, landTaluk, landVillage, pattaNumber,
// chittaNumber, landTenure, leaseDocument? }
// Its own page, asked after Aadhar is verified. The land's District/Taluk/
// Village is asked here (separate from the farmer's residence address
// collected in the Location step) since the land itself may be elsewhere.
// A leased/rented tenure requires a supporting document upload - handled by
// middleware/upload.js ahead of this handler, which populates req.file.
async function submitLandRecords(req, res) {
  try {
    if (!canAct(req, req.params.id)) return res.status(403).json({ message: 'Not authorised' });
    const { landDistrict, landTaluk, landVillage, pattaNumber, chittaNumber, landTenure } = req.body;

    if (!landDistrict || !landTaluk || !landVillage) {
      return res.status(400).json({ message: "The land's district, taluk and village are required" });
    }
    if (!pattaNumber || !chittaNumber) {
      return res.status(400).json({ message: 'pattaNumber and chittaNumber are required' });
    }
    const tenure = landTenure || 'owned';
    if (!['owned', 'leased', 'rented'].includes(tenure)) {
      return res.status(400).json({ message: 'landTenure must be owned, leased or rented' });
    }

    const existing = await Farmer.findById(req.params.id).select('leaseDocumentPath');
    if (!existing) return res.status(404).json({ message: 'Farmer not found' });

    // A newly uploaded file always wins. Otherwise, if the farmer is
    // (re)submitting this step - e.g. resuming the wizard - and already has
    // a document on file from before, keep it rather than wiping it out.
    let leaseDocumentPath = existing.leaseDocumentPath;
    if (req.file) {
      leaseDocumentPath = `/uploads/lease-documents/${req.file.filename}`;
    }
    if (tenure !== 'owned' && !leaseDocumentPath) {
      return res.status(400).json({ message: 'A lease/rental agreement upload is required for leased or rented land' });
    }
    if (tenure === 'owned') {
      leaseDocumentPath = null;
    }

    const farmer = await Farmer.findByIdAndUpdate(
      req.params.id,
      { landDistrict, landTaluk, landVillage, pattaNumber, chittaNumber, landTenure: tenure, leaseDocumentPath },
      { new: true, runValidators: true }
    );
    res.json(farmer);
  } catch (err) {
    res.status(400).json({ message: 'Could not save land record details', error: err.message });
  }
}

// POST /api/farmers/:id/kyc/request-otp
// Reuses the same simulated OTP flow as mobile login/registration - this is
// a demo verification step, not a real UIDAI/e-KYC integration.
async function requestAadharOtp(req, res) {
  try {
    if (!canAct(req, req.params.id)) return res.status(403).json({ message: 'Not authorised' });
    const farmer = await Farmer.findById(req.params.id);
    if (!farmer) return res.status(404).json({ message: 'Farmer not found' });

    const otp = await issueOTP(farmer.mobileNumber, 'aadhar');
    res.json({ message: 'OTP issued for Aadhar verification', ...otp });
  } catch (err) {
    res.status(500).json({ message: 'Could not issue OTP', error: err.message });
  }
}

// POST /api/farmers/:id/kyc/verify-otp  { code }
async function verifyAadharOtp(req, res) {
  try {
    if (!canAct(req, req.params.id)) return res.status(403).json({ message: 'Not authorised' });
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'code is required' });

    const farmer = await Farmer.findById(req.params.id);
    if (!farmer) return res.status(404).json({ message: 'Farmer not found' });

    const result = await verifyOTP(farmer.mobileNumber, code);
    if (!result.valid) return res.status(401).json({ message: result.reason });

    farmer.aadharVerified = true;
    await farmer.save();
    res.json(farmer);
  } catch (err) {
    res.status(500).json({ message: 'Could not verify OTP', error: err.message });
  }
}

// PUT /api/farmers/:id/policy  { accepted: true }
async function acceptPolicy(req, res) {
  try {
    if (!canAct(req, req.params.id)) return res.status(403).json({ message: 'Not authorised' });
    if (!req.body.accepted) return res.status(400).json({ message: 'accepted must be true' });

    const farmer = await Farmer.findByIdAndUpdate(
      req.params.id,
      { policyAccepted: true, policyAcceptedAt: new Date() },
      { new: true }
    );
    if (!farmer) return res.status(404).json({ message: 'Farmer not found' });
    res.json(farmer);
  } catch (err) {
    res.status(500).json({ message: 'Could not record policy acceptance', error: err.message });
  }
}

// PUT /api/farmers/:id/preferred-centres  { centreIds: [...] }
async function updatePreferredCentres(req, res) {
  try {
    if (!canAct(req, req.params.id)) return res.status(403).json({ message: 'Not authorised' });
    const { centreIds } = req.body;
    if (!Array.isArray(centreIds) || centreIds.length === 0) {
      return res.status(400).json({ message: 'centreIds must be a non-empty array' });
    }

    const validCount = await Centre.countDocuments({ _id: { $in: centreIds }, isActive: true });
    if (validCount !== centreIds.length) {
      return res.status(400).json({ message: 'One or more selected centres are invalid or inactive' });
    }

    const farmer = await Farmer.findByIdAndUpdate(
      req.params.id,
      { preferredCentres: centreIds },
      { new: true }
    ).populate('preferredCentres', 'name district taluk village codePrefix');
    if (!farmer) return res.status(404).json({ message: 'Farmer not found' });
    res.json(farmer);
  } catch (err) {
    res.status(400).json({ message: 'Could not update preferred centres', error: err.message });
  }
}

// PUT /api/farmers/:id/bank-details
async function updateBankDetails(req, res) {
  try {
    if (!canAct(req, req.params.id)) return res.status(403).json({ message: 'Not authorised' });
    const { accountHolderName, bankName, accountNumber, ifscCode } = req.body;
    if (!accountHolderName || !bankName || !accountNumber || !ifscCode) {
      return res.status(400).json({ message: 'accountHolderName, bankName, accountNumber and ifscCode are all required' });
    }

    const farmer = await Farmer.findByIdAndUpdate(
      req.params.id,
      { bankDetails: { accountHolderName, bankName, accountNumber, ifscCode } },
      { new: true }
    );
    if (!farmer) return res.status(404).json({ message: 'Farmer not found' });
    res.json(farmer);
  } catch (err) {
    res.status(400).json({ message: 'Could not save bank details', error: err.message });
  }
}

// PUT /api/farmers/:id/personal  { name, gender, dateOfBirth }
async function updatePersonalDetails(req, res) {
  try {
    if (!canAct(req, req.params.id)) return res.status(403).json({ message: 'Not authorised' });
    const { name, gender, dateOfBirth } = req.body;

    const update = { gender: gender || null, dateOfBirth: dateOfBirth || null };
    if (name) update.name = name;

    const farmer = await Farmer.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!farmer) return res.status(404).json({ message: 'Farmer not found' });
    res.json(farmer);
  } catch (err) {
    res.status(400).json({ message: 'Could not save personal details', error: err.message });
  }
}

module.exports = {
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
};
