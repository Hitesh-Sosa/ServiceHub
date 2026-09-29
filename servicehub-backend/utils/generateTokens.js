const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// Short-lived access token: sent on every API request, kept in memory on the
// frontend (not localStorage, to reduce XSS token-theft risk).
function generateAccessToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  });
}

// Long-lived refresh token: only used to silently obtain a new access token.
// We store a HASH of it in the database (RefreshToken model) so that even a
// database leak doesn't expose usable tokens, and so we can revoke individual
// sessions (e.g. on logout or "log out of all devices").
function generateRefreshToken(user) {
  const token = jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  });
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
};
