const bcrypt = require('bcryptjs');
const CropRate = require('../models/CropRate');
const Staff = require('../models/Staff');
const Centre = require('../models/Centre');
const Booking = require('../models/Booking');

// --- Crop rates ---
async function listCropRates(req, res) {
  try {
    const rates = await CropRate.find().sort({ crop: 1 });
    res.json(rates);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch crop rates', error: err.message });
  }
}

// A rate must be a genuine positive finite number - this used to only
// check `ratePerUnit == null`, which lets NaN through silently (NaN == null
// is false), so a stray non-numeric value typed into the field would get
// saved as a literal NaN and render as "₹NaN" forever. See
// utils/ensureCropRateDefaults.js for repairing rates already broken this
// way before this check existed.
function isValidRate(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

async function upsertCropRate(req, res) {
  try {
    const { crop, unit, ratePerUnit, unitWeightKg } = req.body;
    if (!crop || !isValidRate(ratePerUnit)) {
      return res.status(400).json({ message: 'crop is required and ratePerUnit must be a positive number' });
    }

    const rate = await CropRate.findOneAndUpdate(
      { crop },
      { crop, unit: unit || 'bag', ratePerUnit: Number(ratePerUnit), unitWeightKg: unitWeightKg ?? null, effectiveFrom: new Date() },
      { new: true, upsert: true, runValidators: true }
    );
    res.json(rate);
  } catch (err) {
    res.status(400).json({ message: 'Could not save crop rate', error: err.message });
  }
}

// PUT /api/admin/crop-rates/:id - explicit edit-by-id for an existing rate,
// so the admin UI can offer a real inline "Edit" action instead of the
// crop-name-must-match-exactly upsert being the only way to change a rate.
async function updateCropRate(req, res) {
  try {
    const { unit, ratePerUnit, unitWeightKg } = req.body;
    if (!isValidRate(ratePerUnit)) {
      return res.status(400).json({ message: 'ratePerUnit must be a positive number' });
    }

    const rate = await CropRate.findByIdAndUpdate(
      req.params.id,
      { unit: unit || 'bag', ratePerUnit: Number(ratePerUnit), unitWeightKg: unitWeightKg ?? null, effectiveFrom: new Date() },
      { new: true, runValidators: true }
    );
    if (!rate) return res.status(404).json({ message: 'Crop rate not found' });
    res.json(rate);
  } catch (err) {
    res.status(400).json({ message: 'Could not update crop rate', error: err.message });
  }
}

// --- Staff accounts (officers/admins) ---
async function createStaff(req, res) {
  try {
    const { name, username, password, role, centre } = req.body;
    if (!name || !username || !password || !role) {
      return res.status(400).json({ message: 'name, username, password and role are required' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const staff = await Staff.create({ name, username, passwordHash, role, centre: centre || null });

    res.status(201).json({ id: staff._id, name: staff.name, username: staff.username, role: staff.role });
  } catch (err) {
    res.status(400).json({ message: 'Could not create staff account', error: err.message });
  }
}

async function listStaff(req, res) {
  try {
    const staff = await Staff.find().populate('centre', 'name').select('-passwordHash');
    res.json(staff);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch staff', error: err.message });
  }
}

module.exports = { listCropRates, upsertCropRate, updateCropRate, createStaff, listStaff, getStatsOverview };

// --- State-wide (or district-filtered) overview for the Master/State admin. ---
// GET /api/admin/stats-overview?district=&date=YYYY-MM-DD
async function getStatsOverview(req, res) {
  try {
    const { district, date } = req.query;
    const targetDate = date || new Date().toISOString().slice(0, 10);

    const centreFilter = { isActive: true };
    if (district) centreFilter.district = district;
    const centres = await Centre.find(centreFilter).sort({ district: 1, village: 1 });

    const centreIds = centres.map((c) => c._id);
    const bookings = await Booking.find({ centre: { $in: centreIds }, date: targetDate });

    const byCentre = new Map(centreIds.map((id) => [String(id), []]));
    bookings.forEach((b) => {
      byCentre.get(String(b.centre))?.push(b);
    });

    const perCentre = centres.map((centre) => {
      const list = byCentre.get(String(centre._id)) || [];
      return {
        centre: {
          _id: centre._id,
          name: centre.name,
          codePrefix: centre.codePrefix,
          district: centre.district,
          taluk: centre.taluk,
          village: centre.village,
        },
        totalBooked: list.length,
        waiting: list.filter((b) => b.queueStatus === 'waiting').length,
        completed: list.filter((b) => b.queueStatus === 'completed').length,
        cancelled: list.filter((b) => ['cancelled', 'absent'].includes(b.queueStatus)).length,
      };
    });

    const totals = perCentre.reduce(
      (acc, c) => ({
        totalCentres: acc.totalCentres + 1,
        totalBooked: acc.totalBooked + c.totalBooked,
        waiting: acc.waiting + c.waiting,
        completed: acc.completed + c.completed,
        cancelled: acc.cancelled + c.cancelled,
      }),
      { totalCentres: 0, totalBooked: 0, waiting: 0, completed: 0, cancelled: 0 }
    );

    res.json({ date: targetDate, district: district || 'All districts', totals, centres: perCentre });
  } catch (err) {
    res.status(500).json({ message: 'Could not compute overview', error: err.message });
  }
}
