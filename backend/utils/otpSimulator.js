const OTP = require('../models/OTP');

const OTP_TTL_MINUTES = 5;

/**
 * Generates and stores an OTP without sending it through a real SMS
 * provider. In SIMULATE_OTP mode the code is returned directly in the API
 * response so the frontend can display it (clearly labelled as a dev/demo
 * OTP) - this is exactly the swap point described in the brief: replace
 * this file's contents with a real SMS provider call later, and nothing
 * else in the auth flow needs to change.
 */
async function issueOTP(mobileNumber, purpose = 'login') {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await OTP.create({ mobileNumber, code, purpose, expiresAt });

  const simulate = process.env.SIMULATE_OTP !== 'false';
  return { devCode: simulate ? code : undefined, expiresInMinutes: OTP_TTL_MINUTES };
}

async function verifyOTP(mobileNumber, code) {
  const record = await OTP.findOne({
    mobileNumber,
    code,
    consumed: false,
  }).sort({ createdAt: -1 });

  if (!record) return { valid: false, reason: 'OTP not found or already used' };
  if (record.expiresAt < new Date()) return { valid: false, reason: 'OTP expired' };

  record.consumed = true;
  await record.save();
  return { valid: true };
}

module.exports = { issueOTP, verifyOTP };
