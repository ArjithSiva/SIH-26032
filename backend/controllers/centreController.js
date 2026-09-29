const bcrypt = require('bcryptjs');
const Centre = require('../models/Centre');
const Booking = require('../models/Booking');
const { generateCentrePrefix } = require('../utils/centrePrefix');
const { ensureSlotsForDate, recommendSlot } = require('../utils/slotGenerator');
const { DEFAULT_OFFICER_PASSWORD } = require('../utils/ensureCentreDefaults');

async function listCentres(req, res) {
  try {
    const { state, district, taluk, village, crop, ids } = req.query;
    const filter = { isActive: true };
    if (state) filter.state = state;
    if (district) filter.district = district;
    if (taluk) filter.taluk = taluk;
    if (village) filter.village = village;
    if (crop) filter['crops.name'] = crop;
    if (ids) filter._id = { $in: String(ids).split(',').filter(Boolean) };

    const centres = await Centre.find(filter).sort({ village: 1, name: 1 });
    res.json(centres);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch centres', error: err.message });
  }
}

// GET /api/centres/states - distinct states. Only Tamil Nadu exists today,
// but this is asked first in both registration and booking so adding a
// second state later is just more data, not a new UI step.
async function listStates(req, res) {
  try {
    const states = await Centre.distinct('state', { isActive: true });
    res.json(states.sort());
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch states', error: err.message });
  }
}

// GET /api/centres/districts?state=... - districts that actually have a
// bookable centre (used by the booking flow's "find another centre"
// fallback search). Registration's district picker uses the full static
// list at /api/geo/districts instead, since a farmer's home district may
// not have any centre yet.
async function listDistricts(req, res) {
  try {
    const { state } = req.query;
    const filter = { isActive: true };
    if (state) filter.state = state;
    const districts = await Centre.distinct('district', filter);
    res.json(districts.filter(Boolean).sort());
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch districts', error: err.message });
  }
}

// GET /api/centres/taluks?district=... - distinct taluks, scoped to a district.
async function listTaluks(req, res) {
  try {
    const { district } = req.query;
    const filter = { isActive: true };
    if (district) filter.district = district;
    const taluks = await Centre.distinct('taluk', filter);
    res.json(taluks.filter(Boolean).sort());
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch taluks', error: err.message });
  }
}

// GET /api/centres/villages?district=&taluk= - distinct villages, scoped to
// a taluk. Each DPC centre corresponds to exactly one village, so picking a
// village here is how a farmer effectively picks their specific centre.
async function listVillages(req, res) {
  try {
    const { district, taluk } = req.query;
    const filter = { isActive: true };
    if (district) filter.district = district;
    if (taluk) filter.taluk = taluk;
    const villages = await Centre.distinct('village', filter);
    res.json(villages.filter(Boolean).sort());
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch villages', error: err.message });
  }
}

async function getCentre(req, res) {
  try {
    const centre = await Centre.findById(req.params.id);
    if (!centre) return res.status(404).json({ message: 'Centre not found' });
    res.json(centre);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch centre', error: err.message });
  }
}

// POST /api/centres (admin only) - the codePrefix is generated here, once,
// and never changes afterwards since it's baked into every token issued at
// this centre. officerPassword is optional - defaults to the standard
// starter password (also shown in the response once) if not given.
async function createCentre(req, res) {
  try {
    const body = { ...req.body };
    if (!body.district) {
      return res.status(400).json({ message: 'district is required' });
    }
    body.codePrefix = await generateCentrePrefix(body.district);

    const chosenPassword = body.officerPassword || DEFAULT_OFFICER_PASSWORD;
    delete body.officerPassword;
    body.officerPasswordHash = await bcrypt.hash(chosenPassword, 10);
    body.mustChangeOfficerPassword = !req.body.officerPassword;

    const centre = await Centre.create(body);
    const result = centre.toObject();
    // Only moment the plaintext password is ever visible - shown once so
    // whoever created the centre can hand it to that centre's officer.
    result.initialOfficerPassword = chosenPassword;
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ message: 'Could not create centre', error: err.message });
  }
}

// Fields an officer is allowed to touch on their own centre - identity
// fields (name/district/taluk/village/location), codePrefix and
// policyLimits itself all stay admin-only.
const OFFICER_EDITABLE_FIELDS = ['openingTime', 'closingTime', 'slotDurationMinutes', 'capacityPerSlot', 'workingDays', 'crops'];

function timeToMinutes(hhmm) {
  const [h, m] = (hhmm || '0:0').split(':').map(Number);
  return h * 60 + m;
}

// When admin tightens a centre's policyLimits, any of that centre's own
// current operational settings that now fall outside the new bounds are
// clamped to the new bound immediately (rather than left silently
// out-of-policy) so the centre keeps running without a manual follow-up.
// The officer can still adjust their own settings again afterwards, as
// long as they stay within the new bounds.
function clampToNewPolicyLimits(current, limits) {
  const clamped = {};
  if (timeToMinutes(current.openingTime) < timeToMinutes(limits.earliestOpeningTime)) {
    clamped.openingTime = limits.earliestOpeningTime;
  }
  if (timeToMinutes(current.closingTime) > timeToMinutes(limits.latestClosingTime)) {
    clamped.closingTime = limits.latestClosingTime;
  }
  if (current.slotDurationMinutes < limits.minSlotDurationMinutes) {
    clamped.slotDurationMinutes = limits.minSlotDurationMinutes;
  } else if (current.slotDurationMinutes > limits.maxSlotDurationMinutes) {
    clamped.slotDurationMinutes = limits.maxSlotDurationMinutes;
  }
  if (current.capacityPerSlot < limits.minCapacityPerSlot) {
    clamped.capacityPerSlot = limits.minCapacityPerSlot;
  } else if (current.capacityPerSlot > limits.maxCapacityPerSlot) {
    clamped.capacityPerSlot = limits.maxCapacityPerSlot;
  }
  return clamped;
}

// Validates an officer's requested settings against their centre's
// admin-set policyLimits. Returns an error message string, or null if OK.
function validateAgainstPolicyLimits(update, limits) {
  if (!limits) return null;
  if (update.openingTime && timeToMinutes(update.openingTime) < timeToMinutes(limits.earliestOpeningTime)) {
    return `Opening time cannot be earlier than ${limits.earliestOpeningTime} (set by admin)`;
  }
  if (update.closingTime && timeToMinutes(update.closingTime) > timeToMinutes(limits.latestClosingTime)) {
    return `Closing time cannot be later than ${limits.latestClosingTime} (set by admin)`;
  }
  if (update.slotDurationMinutes != null) {
    if (update.slotDurationMinutes < limits.minSlotDurationMinutes || update.slotDurationMinutes > limits.maxSlotDurationMinutes) {
      return `Slot duration must be between ${limits.minSlotDurationMinutes} and ${limits.maxSlotDurationMinutes} minutes (set by admin)`;
    }
  }
  if (update.capacityPerSlot != null) {
    if (update.capacityPerSlot < limits.minCapacityPerSlot || update.capacityPerSlot > limits.maxCapacityPerSlot) {
      return `Queue limit per slot must be between ${limits.minCapacityPerSlot} and ${limits.maxCapacityPerSlot} (set by admin)`;
    }
  }
  return null;
}

// PUT /api/centres/:id - admins can edit any centre and any field
// (including policyLimits itself); an officer can edit only their own
// centre, only the operational fields above, and only within the bounds
// their centre's policyLimits allow.
async function updateCentre(req, res) {
  try {
    const existing = await Centre.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Centre not found' });

    let update = { ...req.body };
    delete update.codePrefix;

    if (req.user.role === 'officer') {
      if (String(req.user.centre) !== String(req.params.id)) {
        return res.status(403).json({ message: 'Officers can only update their own centre' });
      }
      update = Object.fromEntries(Object.entries(update).filter(([key]) => OFFICER_EDITABLE_FIELDS.includes(key)));

      const violation = validateAgainstPolicyLimits(update, existing.policyLimits);
      if (violation) return res.status(400).json({ message: violation });
    } else if (update.policyLimits) {
      // Admin is tightening (or otherwise changing) this centre's policy
      // bounds - force-update any of its own settings that are now
      // out-of-bounds so the centre stays operational immediately.
      Object.assign(update, clampToNewPolicyLimits(existing, update.policyLimits));
    }

    const centre = await Centre.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    res.json(centre);
  } catch (err) {
    res.status(400).json({ message: 'Could not update centre', error: err.message });
  }
}

// PUT /api/centres/:id/password  { newPassword, currentPassword? }
// Admin can reset any centre's password outright. An officer changing their
// own centre's password must supply the current one first.
async function setOfficerPassword(req, res) {
  try {
    const centre = await Centre.findById(req.params.id).select('+officerPasswordHash');
    if (!centre) return res.status(404).json({ message: 'Centre not found' });

    const { newPassword, currentPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'newPassword must be at least 6 characters' });
    }

    if (req.user.role === 'officer') {
      if (String(req.user.centre) !== String(req.params.id)) {
        return res.status(403).json({ message: 'Officers can only change their own centre password' });
      }
      const match = centre.officerPasswordHash && (await bcrypt.compare(currentPassword || '', centre.officerPasswordHash));
      if (!match) return res.status(401).json({ message: 'Current password is incorrect' });
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorised' });
    }

    centre.officerPasswordHash = await bcrypt.hash(newPassword, 10);
    centre.mustChangeOfficerPassword = false;
    await centre.save();

    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ message: 'Could not update password', error: err.message });
  }
}

// GET /api/centres/recommendations?centreIds=a,b,c&date=YYYY-MM-DD&crop=Paddy
// OR   /api/centres/recommendations?crop=Paddy&date=YYYY-MM-DD  (no centreIds)
//
// With centreIds: recommends the best slot among exactly those centres
// (used for "among my preferred centres"). Without centreIds: searches
// statewide for centres that accept the given crop (used as the fallback
// when none of the farmer's preferred centres take that crop, or for
// "find another centre"), capped to a sane number so it stays fast.
async function getRecommendations(req, res) {
  try {
    const { centreIds, date, crop, district } = req.query;
    if (!date) return res.status(400).json({ message: 'date is required' });

    let centres;
    if (centreIds) {
      const ids = String(centreIds).split(',').filter(Boolean);
      centres = await Centre.find({ _id: { $in: ids }, isActive: true });
    } else {
      if (!crop) return res.status(400).json({ message: 'crop is required when centreIds is omitted' });
      const filter = { isActive: true, 'crops.name': crop };
      if (district) filter.district = district;
      centres = await Centre.find(filter).limit(20);
    }

    const results = [];
    for (const centre of centres) {
      if (crop && centre.crops?.length && !centre.crops.some((c) => c.name === crop)) {
        // eslint-disable-next-line no-continue
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const slots = await ensureSlotsForDate(centre, date);
      const best = recommendSlot(slots);
      // eslint-disable-next-line no-await-in-loop
      const totalBookedToday = await Booking.countDocuments({ centre: centre._id, date, queueStatus: { $ne: 'cancelled' } });

      results.push({
        centre,
        totalBookedToday,
        bestSlot: best ? best.slot : null,
        estimatedWaitMinutes: best ? best.estimatedWaitMinutes : null,
      });
    }

    results.sort((a, b) => {
      if (a.bestSlot && !b.bestSlot) return -1;
      if (!a.bestSlot && b.bestSlot) return 1;
      return (a.estimatedWaitMinutes ?? Infinity) - (b.estimatedWaitMinutes ?? Infinity);
    });

    res.json({
      recommended: results[0] || null,
      alternatives: results.slice(1),
    });
  } catch (err) {
    res.status(500).json({ message: 'Could not compute recommendations', error: err.message });
  }
}

module.exports = {
  listCentres,
  getCentre,
  createCentre,
  updateCentre,
  setOfficerPassword,
  listStates,
  listDistricts,
  listTaluks,
  listVillages,
  getRecommendations,
};
