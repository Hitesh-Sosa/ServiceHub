const rateLimit = require("express-rate-limit");

// Generic login/register abuse protection
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts from this IP. Please try again later." },
});

// Tighter limit specifically for OTP requests, since sending OTPs costs money
// (SMS) and can be used to spam/harass a phone number or inbox.
const otpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1, // exactly one OTP request per minute per IP (matches the 1-minute OTP validity)
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Please wait before requesting another OTP." },
});

module.exports = { authLimiter, otpLimiter };
