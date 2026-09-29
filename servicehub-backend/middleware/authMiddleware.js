const User = require("../models/User");
const { verifyAccessToken } = require("../utils/generateTokens");

async function protect(req, res, next) {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token provided" });
  }

  try {
    const decoded = verifyAccessToken(token);
    req.user = await User.findById(decoded.id);
    if (!req.user) {
      return res.status(401).json({ message: "Not authorized, user no longer exists" });
    }

    // NEW: a suspended provider is locked out of the ENTIRE API immediately -
    // even with a valid, unexpired access token.
    if (req.user.accountStatus === "Suspended") {
      return res.status(403).json({ message: "Your account has been suspended. Please contact support." });
    }

    next();
  } catch (err) {
    return res.status(401).json({ message: "Not authorized, invalid or expired token" });
  }
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: insufficient permissions" });
    }
    next();
  };
}

module.exports = { protect, authorize };