const { body, validationResult } = require("express-validator");

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
  }
  next();
}

const registerRules = [
  body("name").trim().notEmpty().withMessage("Name is required").isLength({ min: 2, max: 60 }),
  body("email").trim().isEmail().withMessage("A valid email is required").normalizeEmail(),
  body("mobile")
    .trim()
    .matches(/^\+[1-9]\d{9,14}$/)
    .withMessage("Mobile must be in international format, e.g. +919876543210"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number")
    .matches(/[^A-Za-z0-9]/)
    .withMessage("Password must contain at least one special character"),
  body("role").isIn(["Customer", "Provider"]).withMessage('Role must be "Customer" or "Provider"'),
  body("verifyVia").isIn(["email", "mobile"]).withMessage('verifyVia must be "email" or "mobile"'),
  handleValidation,
];

const loginRules = [
  body("email").trim().isEmail().withMessage("A valid email is required").normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
  handleValidation,
];

// NEW: rules for passwordless OTP login
const loginOtpRequestRules = [
  body("identifier").trim().notEmpty().withMessage("Email or mobile number is required"),
  body("channel").isIn(["email", "mobile"]).withMessage('channel must be "email" or "mobile"'),
  handleValidation,
];

const otpVerifyRules = [
  body("userId").notEmpty().withMessage("userId is required"),
  body("otp")
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits")
    .isNumeric()
    .withMessage("OTP must be numeric"),
  handleValidation,
];

const resendOtpRules = [
  body("userId").notEmpty().withMessage("userId is required"),
  body("channel").isIn(["email", "mobile"]).withMessage('channel must be "email" or "mobile"'),
  handleValidation,
];

const googleAuthRules = [
  body("idToken").notEmpty().withMessage("idToken is required"),
  handleValidation,
];

module.exports = {
  registerRules,
  loginRules,
  loginOtpRequestRules,
  otpVerifyRules,
  resendOtpRules,
  googleAuthRules,
};