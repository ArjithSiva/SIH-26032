// This module used to call Google Cloud Translation directly. It's kept as
// a thin, same-signature wrapper around utils/bhashiniClient.js so every
// existing caller (ivrController.js, etc.) works unchanged - the actual
// Google -> Bhashini swap lives entirely in bhashiniClient.js.
const { translateText, translateBatch } = require('./bhashiniClient');

module.exports = { translateText, translateBatch };
