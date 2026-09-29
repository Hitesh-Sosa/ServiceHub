const express = require("express");

const {
  register,
  verifyOtp,
  resendOtp,
  login,
  forgotPassword,
  resetPassword,
  requestLoginOtp,
  googleAuth,
  completeProfile,
  refreshTokenHandler,
  logout,
} = require("../controllers/authController");

const {
  protect,
} = require("../middleware/authMiddleware");

const {
  authLimiter,
  otpLimiter,
} = require("../middleware/rateLimiter");

const {
  registerRules,
  loginRules,
  loginOtpRequestRules,
  otpVerifyRules,
  resendOtpRules,
  googleAuthRules,
} = require("../middleware/validators");

const router = express.Router();

// =====================================================
// REGISTER
// =====================================================

router.post(
  "/register",
  authLimiter,
  registerRules,
  register
);

// =====================================================
// VERIFY OTP
// =====================================================

router.post(
  "/verify-otp",
  authLimiter,
  otpVerifyRules,
  verifyOtp
);

// =====================================================
// RESEND OTP
// =====================================================

router.post(
  "/resend-otp",
  otpLimiter,
  resendOtpRules,
  resendOtp
);

// =====================================================
// LOGIN
// =====================================================

router.post(
  "/login",
  authLimiter,
  loginRules,
  login
);

// =====================================================
// LOGIN USING OTP
// =====================================================

router.post(
  "/login-otp",
  otpLimiter,
  loginOtpRequestRules,
  requestLoginOtp
);

// =====================================================
// FORGOT PASSWORD
// =====================================================

router.post(
  "/forgot-password",
  otpLimiter,
  forgotPassword
);

// =====================================================
// RESET PASSWORD
// =====================================================

router.post(
  "/reset-password",
  otpLimiter,
  resetPassword
);

// =====================================================
// GOOGLE LOGIN
// =====================================================

router.post(
  "/google",
  authLimiter,
  googleAuthRules,
  googleAuth
);

// =====================================================
// COMPLETE PROFILE
// =====================================================

router.post(
  "/complete-profile",
  protect,
  completeProfile
);

// =====================================================
// REFRESH TOKEN
// =====================================================

router.post(
  "/refresh-token",
  refreshTokenHandler
);

// =====================================================
// LOGOUT
// =====================================================

router.post(
  "/logout",
  logout
);

// =====================================================
// EXPORT ROUTER
// IMPORTANT: Export router directly
// =====================================================

module.exports = router;