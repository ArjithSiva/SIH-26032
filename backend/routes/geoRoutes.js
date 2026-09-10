const express = require('express');
const { listAllDistricts, listTaluksForDistrict, listVillagesForTaluk } = require('../controllers/geoController');

const router = express.Router();

router.get('/districts', listAllDistricts);
router.get('/taluks', listTaluksForDistrict);
router.get('/villages', listVillagesForTaluk);

module.exports = router;
