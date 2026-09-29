const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const RefreshToken = require("../models/RefreshToken");
const { hashForLookup } = require("../utils/encryption");
const { generateOtp, hashOtp, compareOtp, OTP_VALID_MS, MAX_OTP_ATTEMPTS } = require("../utils/otp");
const { sendOtpEmail, sendPasswordResetEmail } = require("../utils/sendEmail");
const { sendOtpSms } = require("../utils/sendSMS");
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
} = require("../utils/generateTokens");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ---------- helpers ----------
async function issueTokens(user) {
  const accessToken = generateAccessToken(user);
  const { token: refreshToken, tokenHash } = generateRefreshToken(user);

  await RefreshToken.create({
    user: user._id,
    tokenHash,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });

  return { accessToken, refreshToken };
}

async function createAndSendOtp(user, channel, purpose) {
  const otp = generateOtp();
  user.otpHash = await hashOtp(otp);
  user.otpExpiresAt = new Date(Date.now() + OTP_VALID_MS);
  user.otpChannel = channel;
  user.otpPurpose = purpose;
  user.otpAttempts = 0;
  user.otpLastSentAt = new Date();
  await user.save();

  if (channel === "email") {
    // reset-password OTPs get their own email template
    if (purpose === "reset-password") {
      await sendPasswordResetEmail(user.email, otp);
    } else {
      await sendOtpEmail(user.email, otp);
    }
  } else {
    await sendOtpSms(user.getMobile(), otp);
  }
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    isMobileVerified: user.isMobileVerified,
  };
}

// ============================================================
// POST /api/auth/register
// ============================================================
async function register(req, res, next) {
  try {
    const { name, email, password, mobile, role, verifyVia } = req.body;

    const mobileHash = hashForLookup(mobile);
    let user = await User.findOne({ $or: [{ email }, { mobileHash }] });

    if (user) {
      if (user.isEmailVerified || user.isMobileVerified) {
        return res.status(400).json({ message: "An account with this email or mobile number already exists" });
      }
      user.name = name;
      user.email = email;
      if (password) user.password = password;
      user.role = role;
      user.authProvider = "local";
      user.setMobile(mobile);
    } else {
      user = new User({ name, email, password, role, authProvider: "local" });
      user.setMobile(mobile);
    }

    const wasNew = user.isNew;

    try {
      await user.save();
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ message: "An account with this email or mobile number already exists" });
      }
      throw err;
    }

    await createAndSendOtp(user, verifyVia, "register");

    res.status(wasNew ? 201 : 200).json({
      message: `OTP sent to your ${verifyVia}. It is valid for 1 minute.`,
      userId: user._id,
      otpChannel: verifyVia,
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// POST /api/auth/verify-otp
// ============================================================
async function verifyOtp(req, res, next) {
  try {
    const { userId, otp } = req.body;

    const user = await User.findById(userId).select("+otpHash +otpExpiresAt +otpChannel +otpPurpose +otpAttempts");
    if (!user || !user.otpHash) {
      return res.status(400).json({ message: "No pending OTP for this account. Please request a new one." });
    }

    // NEW: a password-reset OTP must never be accepted here (this endpoint
    // issues login tokens). The reset OTP can only be used at /reset-password.
    if (user.otpPurpose === "reset-password") {
      return res.status(400).json({ message: "This OTP is for password reset. Use the reset-password endpoint." });
    }

    if (user.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });
    }

    if (user.otpAttempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({ message: "Too many incorrect attempts. Please request a new OTP." });
    }

    const isMatch = await compareOtp(otp, user.otpHash);
    if (!isMatch) {
      user.otpAttempts += 1;
      await user.save();
      return res.status(400).json({
        message: "Incorrect OTP",
        attemptsRemaining: MAX_OTP_ATTEMPTS - user.otpAttempts,
      });
    }

    if (user.otpChannel === "email") user.isEmailVerified = true;
    else user.isMobileVerified = true;

    user.otpHash = undefined;
    user.otpExpiresAt = undefined;
    user.otpChannel = undefined;
    user.otpPurpose = undefined;
    user.otpAttempts = 0;
    await user.save();

    const tokens = await issueTokens(user);

    res.json({
      message: "Verification successful",
      user: publicUser(user),
      ...tokens,
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// POST /api/auth/resend-otp
// ============================================================
async function resendOtp(req, res, next) {
  try {
    const { userId, channel } = req.body;
    const user = await User.findById(userId).select("+otpLastSentAt");
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.otpLastSentAt && Date.now() - user.otpLastSentAt.getTime() < OTP_VALID_MS) {
      return res.status(429).json({ message: "Please wait for the current OTP to expire before requesting a new one" });
    }

    await createAndSendOtp(user, channel, user.isEmailVerified || user.isMobileVerified ? "login" : "register");
    res.json({ message: `A new OTP has been sent to your ${channel}. Valid for 1 minute.` });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// POST /api/auth/login  (email + password)
// ============================================================
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password +failedLoginAttempts +lockUntil");
    if (!user || user.authProvider !== "local") {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    if (user.isLocked()) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({ message: `Account temporarily locked. Try again in ${minutesLeft} minute(s).` });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await user.registerFailedLogin();
      return res.status(400).json({ message: "Invalid email or password" });
    }

    await user.resetFailedLogins();

    if (!user.isEmailVerified && !user.isMobileVerified) {
      return res.status(403).json({
        message: "Account not verified. Please complete OTP verification first.",
        userId: user._id,
        requiresVerification: true,
      });
    }

    const tokens = await issueTokens(user);
    res.json({ message: "Login successful", user: publicUser(user), ...tokens });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// POST /api/auth/forgot-password  (NEW)
// Body: { email }
// Always returns the same generic response so attackers can't
// discover which emails are registered.
// ============================================================
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const generic = { message: "If that email is registered, a password reset OTP has been sent." };

    const user = await User.findOne({ email });
    if (!user) return res.json(generic);

    await createAndSendOtp(user, "email", "reset-password");

    res.json({ ...generic, userId: user._id });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// POST /api/auth/reset-password  (NEW)
// Body: { userId, otp, newPassword }
// ============================================================
async function resetPassword(req, res, next) {
  try {
    const { userId, otp, newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: "newPassword must be at least 8 characters" });
    }

    const user = await User.findById(userId).select("+otpHash +otpExpiresAt +otpChannel +otpPurpose +otpAttempts");
    if (!user || !user.otpHash || user.otpPurpose !== "reset-password") {
      return res.status(400).json({ message: "No pending password reset for this account. Please request a new OTP." });
    }

    if (user.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: "Reset OTP has expired. Please request a new one." });
    }

    if (user.otpAttempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({ message: "Too many incorrect attempts. Please request a new OTP." });
    }

    const isMatch = await compareOtp(otp, user.otpHash);
    if (!isMatch) {
      user.otpAttempts += 1;
      await user.save();
      return res.status(400).json({
        message: "Incorrect OTP",
        attemptsRemaining: MAX_OTP_ATTEMPTS - user.otpAttempts,
      });
    }

    // pre-save hook hashes this automatically
    user.password = newPassword;

    user.otpHash = undefined;
    user.otpExpiresAt = undefined;
    user.otpChannel = undefined;
    user.otpPurpose = undefined;
    user.otpAttempts = 0;
    await user.save();

    res.json({ message: "Password updated successfully. Please log in with your new password." });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// POST /api/auth/login-otp   (passwordless login)
// ============================================================
async function requestLoginOtp(req, res, next) {
  try {
    const { identifier, channel } = req.body;

    const fail = () => res.status(400).json({ message: "Invalid email or mobile number" });

    let user;
    if (channel === "email") {
      user = await User.findOne({ email: identifier });
    } else {
      user = await User.findOne({ mobileHash: hashForLookup(identifier) });
    }
    if (!user) return fail();

    if (user.isLocked()) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({ message: `Account temporarily locked. Try again in ${minutesLeft} minute(s).` });
    }

    if (channel === "email" && !user.isEmailVerified) {
      return res.status(400).json({ message: "Email not verified on this account. Use mobile OTP instead." });
    }
    if (channel === "mobile" && !user.isMobileVerified) {
      return res.status(400).json({ message: "Mobile not verified on this account. Use email OTP instead." });
    }

    await createAndSendOtp(user, channel, "login");

    res.json({
      message: `OTP sent to your ${channel}. It is valid for 1 minute.`,
      userId: user._id,
      otpChannel: channel,
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// POST /api/auth/google
// ============================================================
async function googleAuth(req, res, next) {
  try {
    const { idToken } = req.body;

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, email_verified } = payload;

    if (!email_verified) {
      return res.status(400).json({ message: "Google account email is not verified" });
    }

    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (user && !user.googleId) {
      user.googleId = googleId;
      user.isEmailVerified = true;
      await user.save();
    }

    if (!user) {
      user = await User.create({
        name,
        email,
        role: "Customer",
        authProvider: "google",
        googleId,
        isEmailVerified: true,
        mobileEncrypted: "PENDING",
        mobileHash: hashForLookup(`pending-${googleId}`),
      });

      const tokens = await issueTokens(user);
      return res.status(201).json({
        message: "Google sign-up successful. Please complete your profile.",
        profileIncomplete: true,
        user: publicUser(user),
        ...tokens,
      });
    }

    const tokens = await issueTokens(user);
    res.json({ message: "Google login successful", user: publicUser(user), ...tokens });
  } catch (err) {
    if (err.message && err.message.includes("Token used too late")) {
      return res.status(400).json({ message: "Google sign-in expired, please try again" });
    }
    next(err);
  }
}

// ============================================================
// POST /api/auth/complete-profile
// ============================================================
async function completeProfile(req, res, next) {
  try {
    const { mobile, role } = req.body;
    const user = req.user;

    if (user.authProvider !== "google") {
      return res.status(400).json({ message: "This endpoint is only for Google sign-up accounts" });
    }

    const mobileHash = hashForLookup(mobile);
    const existing = await User.findOne({ mobileHash, _id: { $ne: user._id } });
    if (existing) {
      return res.status(400).json({ message: "This mobile number is already registered" });
    }

    user.setMobile(mobile);
    if (role) user.role = role;
    await user.save();

    await createAndSendOtp(user, "mobile", "register");

    res.json({ message: "Profile updated. OTP sent to your mobile for mobile verification." });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// POST /api/auth/refresh-token
// ============================================================
async function refreshTokenHandler(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ message: "refreshToken is required" });

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }

    const tokenHash = hashToken(refreshToken);
    const stored = await RefreshToken.findOne({ tokenHash, user: decoded.id, revoked: false });
    if (!stored || stored.expiresAt < new Date()) {
      return res.status(401).json({ message: "Refresh token is no longer valid. Please log in again." });
    }

    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: "User no longer exists" });

    const accessToken = generateAccessToken(user);
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// POST /api/auth/logout
// ============================================================
async function logout(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await RefreshToken.updateOne({ tokenHash }, { revoked: true });
    }
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    next(err);
  }
}

module.exports = {
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
};