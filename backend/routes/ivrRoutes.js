const express = require('express');
const { getPrompt, getAllPrompts, translateArbitraryText, speak } = require('../controllers/ivrController');

const router = express.Router();

router.get('/prompts', getAllPrompts);
router.get('/prompt/:step', getPrompt);
router.post('/translate', translateArbitraryText);
router.post('/speak', speak);

module.exports = router;
