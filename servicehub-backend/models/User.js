const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { encrypt, decrypt, hashForLookup } = require("../utils/encryption");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },

    password: { type: String, minlength: 8, select: false },

    role: { type: String, enum: ["Customer", "Provider", "Admin"], required: true },

    mobileEncrypted: { type: String, required: true },
    mobileHash: { type: String, required: true, unique: true },

    // --- Verification status ---
    isEmailVerified: { type: Boolean, default: false },
    isMobileVerified: { type: Boolean, default: false },

    // --- Provider-specific ---
    isProviderVerified: { type: Boolean, default: false },

    // NEW: admin-managed account status. A suspended provider disappears from
    // listings and is blocked from the whole API (see authMiddleware).
    accountStatus: { type: String, enum: ["Active", "Suspended"], default: "Active" },
    suspensionReason: { type: String, default: null },

    averageRating: { type: Number, default: 0 },

    // --- OTP (registration / login / password reset) ---
    otpHash: { type: String, select: false },
    otpExpiresAt: { type: Date, select: false },
    otpChannel: { type: String, enum: ["email", "mobile"], select: false },
    // "reset-password" added for the forgot-password flow
    otpPurpose: { type: String, enum: ["register", "login", "reset-password"], select: false },
    otpAttempts: { type: Number, default: 0, select: false },
    otpLastSentAt: { type: Date, select: false },

    // --- Account lockout (brute-force protection) ---
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },

    // --- Auth provider ---
    authProvider: { type: String, enum: ["local", "google"], default: "local" },
    googleId: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

// ---------- Password hashing ----------
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidatePassword) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(candidatePassword, this.password);
};

// ---------- Mobile helpers ----------
userSchema.methods.setMobile = function (plainMobile) {
  this.mobileEncrypted = encrypt(plainMobile);
  this.mobileHash = hashForLookup(plainMobile);
};

userSchema.methods.getMobile = function () {
  return decrypt(this.mobileEncrypted);
};

// ---------- Account lockout helpers ----------
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

userSchema.methods.registerFailedLogin = async function () {
  this.failedLoginAttempts = (this.failedLoginAttempts || 0) + 1;
  if (this.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
    this.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
    this.failedLoginAttempts = 0;
  }
  await this.save();
};

userSchema.methods.resetFailedLogins = async function () {
  this.failedLoginAttempts = 0;
  this.lockUntil = undefined;
  await this.save();
};

module.exports = mongoose.model("User", userSchema);