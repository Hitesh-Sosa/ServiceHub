const User = require("../models/User");
const RefreshToken = require("../models/RefreshToken");

// Never leak mobileHash (internal lookup index) or password-related fields.
// Only the profile owner or an Admin gets the decrypted mobile number back -
// everyone else sees a safe public subset.
function serializeUser(user, requester) {
  const isOwnerOrAdmin =
    requester && (requester._id.toString() === user._id.toString() || requester.role === "Admin");

  const base = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    isMobileVerified: user.isMobileVerified,
    isProviderVerified: user.isProviderVerified,
    createdAt: user.createdAt,
  };

  if (isOwnerOrAdmin) {
    base.mobile = user.getMobile();
  }

  return base;
}

// GET /api/users/:id
async function getUserById(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(serializeUser(user, req.user));
  } catch (err) {
    next(err);
  }
}

// PUT /api/users/:id
async function updateUser(req, res, next) {
  try {
    if (req.user._id.toString() !== req.params.id && req.user.role !== "Admin") {
      return res.status(403).json({ message: "You can only update your own profile" });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { name, email, mobile } = req.body;
    if (name) user.name = name;
    if (email && email !== user.email) {
      // FIXED: changing the email address now resets email verification, so a
      // user can't swap in an unverified address and keep a "verified" flag.
      user.email = email;
      user.isEmailVerified = false;
    }
    if (mobile) user.setMobile(mobile); // re-encrypts + re-hashes

    await user.save();
    res.json({ message: "Profile updated successfully", user: serializeUser(user, req.user) });
  } catch (err) {
    // FIXED: a duplicate email/mobile used to fall through as a raw 500.
    if (err.code === 11000) {
      return res.status(400).json({ message: "An account with this email or mobile number already exists" });
    }
    next(err);
  }
}

// DELETE /api/users/:id
async function deleteUser(req, res, next) {
  try {
    if (req.user._id.toString() !== req.params.id && req.user.role !== "Admin") {
      return res.status(403).json({ message: "You can only delete your own account" });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // FIXED: also revoke every refresh token so a deleted account's sessions
    // die immediately instead of lingering for up to 7 days.
    await RefreshToken.deleteMany({ user: user._id });

    res.json({ message: "Account deleted successfully" });
  } catch (err) {
    next(err);
  }
}

module.exports = { getUserById, updateUser, deleteUser };
