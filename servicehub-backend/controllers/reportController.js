const Report = require("../models/Report");
const User = require("../models/User");
const Booking = require("../models/Booking");

// Fake-provider defense: if a provider collects 3 or more reports within
// 7 days, they are auto-suspended immediately (before any admin looks at it).
// Suspended providers vanish from listings and are locked out of the API.
const AUTO_SUSPEND_THRESHOLD = 3;
const WINDOW_DAYS = 7;

// POST /api/reports   { providerId, bookingId?, reason, details? }
async function createReport(req, res, next) {
  try {
    const { providerId, bookingId, reason, details } = req.body;

    if (!providerId || !reason) {
      return res.status(400).json({ message: "providerId and reason are required" });
    }

    const provider = await User.findOne({ _id: providerId, role: "Provider" });
    if (!provider) return res.status(404).json({ message: "Provider not found" });

    if (providerId === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot report yourself" });
    }

    // optional: the cited booking must exist and belong to the reporter
    if (bookingId) {
      const booking = await Booking.findOne({ _id: bookingId, customer: req.user._id });
      if (!booking) {
        return res.status(400).json({ message: "Booking not found on your account" });
      }
    }

    // one report per customer per provider (also enforced by a unique index)
    const dup = await Report.findOne({ reportedProvider: providerId, reportedBy: req.user._id });
    if (dup) {
      return res.status(409).json({ message: "You have already reported this provider" });
    }

    const report = await Report.create({
      reportedProvider: providerId,
      reportedBy: req.user._id,
      booking: bookingId || undefined,
      reason,
      details,
    });

    // ---- auto-suspend check ----
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const recentCount = await Report.countDocuments({
      reportedProvider: providerId,
      createdAt: { $gte: since },
    });

    let autoSuspended = false;
    if (recentCount >= AUTO_SUSPEND_THRESHOLD && provider.accountStatus === "Active") {
      provider.accountStatus = "Suspended";
      provider.suspensionReason = `Auto-suspended: ${recentCount} reports within ${WINDOW_DAYS} days`;
      await provider.save();
      autoSuspended = true;
    }

    res.status(201).json({
      message: "Report submitted. Our team will review it.",
      reportId: report._id,
      autoSuspended,
    });
  } catch (err) {
    // duplicate index hit from a race between two tabs
    if (err.code === 11000) {
      return res.status(409).json({ message: "You have already reported this provider" });
    }
    next(err);
  }
}

module.exports = { createReport };