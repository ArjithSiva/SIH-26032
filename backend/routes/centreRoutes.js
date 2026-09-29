const express = require('express');
const {
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
} = require('../controllers/centreController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Specific routes before /:id so these aren't parsed as an id.
router.get('/states', listStates);
router.get('/districts', listDistricts);
router.get('/taluks', listTaluks);
router.get('/villages', listVillages);
router.get('/recommendations', getRecommendations);
router.get('/', listCentres);
router.get('/:id', getCentre);
router.post('/', requireAuth(['admin']), createCentre);
router.put('/:id', requireAuth(['admin', 'officer']), updateCentre);
router.put('/:id/password', requireAuth(['admin', 'officer']), setOfficerPassword);

module.exports = router;
