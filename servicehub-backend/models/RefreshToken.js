const mongoose = require("mongoose");

// Storing hashed refresh tokens (never the raw token) lets us:
// 1. Revoke a single session on logout
// 2. Support "logout of all devices" (delete all rows for a user)
// 3. Detect refresh-token reuse after revocation (a sign of token theft)
const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revoked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// MongoDB TTL index: automatically deletes expired token records
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("RefreshToken", refreshTokenSchema);
