const { TN_DISTRICTS } = require('../utils/tnGeo');
const locationTree = require('../seed/data/tn-locations-full.json');

// GET /api/geo/districts
// The complete, static list of all 38 Tamil Nadu districts - independent of
// where DPC centres currently exist, so a farmer from any district can
// register. (Centre-derived /api/centres/districts stays as-is for the
// booking flow, which does need to be scoped to districts with a centre.)
function listAllDistricts(req, res) {
  res.json(TN_DISTRICTS);
}

// GET /api/geo/taluks?district=...
// Every taluk on record for that district in the uploaded TNCSC dataset,
// regardless of current DPC Open/Closed status - this is real government
// taluk data, not limited to villages that happen to have an active
// procurement season right now.
function listTaluksForDistrict(req, res) {
  const { district } = req.query;
  if (!district) return res.status(400).json({ message: 'district is required' });

  const taluks = locationTree.districts[district];
  res.json(taluks ? Object.keys(taluks).sort() : []);
}

// GET /api/geo/villages?district=...&taluk=...
function listVillagesForTaluk(req, res) {
  const { district, taluk } = req.query;
  if (!district || !taluk) {
    return res.status(400).json({ message: 'district and taluk are required' });
  }

  const villages = locationTree.districts[district]?.[taluk];
  res.json(villages || []);
}

module.exports = { listAllDistricts, listTaluksForDistrict, listVillagesForTaluk };
