const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const OTP_LENGTH = 6;
const OTP_VALID_MS = 60 * 1000; // 1 minute, as requested
const MAX_OTP_ATTEMPTS = 5;

// crypto.randomInt is a cryptographically secure RNG - Math.random() is NOT
// safe for anything security-related (OTPs, tokens, etc.)
function generateOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

async function hashOtp(otp) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(otp, salt);
}

function compareOtp(candidateOtp, hashedOtp) {
  return bcrypt.compare(candidateOtp, hashedOtp);
}

module.exports = {
  OTP_LENGTH,
  OTP_VALID_MS,
  MAX_OTP_ATTEMPTS,
  generateOtp,
  hashOtp,
  compareOtp,
};
