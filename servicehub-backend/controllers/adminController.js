const User = require("../models/User");
const Kyc = require("../models/Kyc");
const Report = require("../models/Report");

// GET /api/admin/providers?verified=false
async function getProviders(req, res, next) {
  try {
    const filter = { role: "Provider" };
    if (req.query.verified !== undefined) {
      filter.isProviderVerified = req.query.verified === "true";
    }
    const providers = await User.find(filter).select("-password -mobileEncrypted -mobileHash");
    res.json(providers);
  } catch (err) {
    next(err);
  }
}

// PUT /api/admin/providers/:id/verify   (simple manual verify, kept for compatibility)
async function verifyProvider(req, res, next) {
  try {
    const { isVerified } = req.body;
    if (typeof isVerified !== "boolean") {
      return res.status(400).json({ message: "isVerified (boolean) is required" });
    }

    const provider = await User.findOne({ _id: req.params.id, role: "Provider" });
    if (!provider) return res.status(404).json({ message: "Provider not found" });

    provider.isProviderVerified = isVerified;
    await provider.save();

    res.json({
      message: "Provider verification updated",
      isProviderVerified: provider.isProviderVerified,
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// NEW - KYC document review
// ============================================================

// GET /api/admin/kyc?status=Pending
async function getKycSubmissions(req, res, next) {
  try {
    const filter = req.query.status ? { status: req.query.status } : {};
    const submissions = await Kyc.find(filter)
      .populate("provider", "name email isProviderVerified accountStatus")
      .sort("-createdAt");
    res.json(submissions);
  } catch (err) {
    next(err);
  }
}

// PUT /api/admin/kyc/:id/review   { action: "approve" | "reject", reason }
async function reviewKyc(req, res, next) {
  try {
    const { action, reason } = req.body;
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ message: 'action must be "approve" or "reject"' });
    }

    const kyc = await Kyc.findById(req.params.id);
    if (!kyc) return res.status(404).json({ message: "KYC submission not found" });
    if (kyc.status !== "Pending") {
      return res.status(400).json({ message: `This KYC is already ${kyc.status}` });
    }

    kyc.status = action === "approve" ? "Approved" : "Rejected";
    kyc.rejectionReason = action === "reject" ? reason || "Not specified" : null;
    kyc.reviewedBy = req.user._id;
    kyc.reviewedAt = new Date();
    await kyc.save();

    // approving KYC = provider becomes verified (visible + bookable)
    await User.findByIdAndUpdate(kyc.provider, { isProviderVerified: action === "approve" });

    res.json({ message: `KYC ${kyc.status.toLowerCase()}`, kyc });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// NEW - Suspend / unsuspend
// ============================================================

// PUT /api/admin/providers/:id/suspend   { reason }
async function suspendProvider(req, res, next) {
  try {
    const provider = await User.findOne({ _id: req.params.id, role: "Provider" });
    if (!provider) return res.status(404).json({ message: "Provider not found" });

    provider.accountStatus = "Suspended";
    provider.suspensionReason = req.body.reason || "Admin decision";
    await provider.save();

    res.json({
      message: "Provider suspended",
      providerId: provider._id,
      accountStatus: provider.accountStatus,
      suspensionReason: provider.suspensionReason,
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/admin/providers/:id/unsuspend
async function unsuspendProvider(req, res, next) {
  try {
    const provider = await User.findOne({ _id: req.params.id, role: "Provider" });
    if (!provider) return res.status(404).json({ message: "Provider not found" });

    provider.accountStatus = "Active";
    provider.suspensionReason = null;
    await provider.save();

    res.json({ message: "Provider reinstated", providerId: provider._id, accountStatus: provider.accountStatus });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// NEW - Reports queue
// ============================================================

// GET /api/admin/reports
async function getReports(req, res, next) {
  try {
    const filter = req.query.status ? { status: req.query.status } : {};
    const reports = await Report.find(filter)
      .populate("reportedProvider", "name email accountStatus suspensionReason")
      .populate("reportedBy", "name email")
      .sort("-createdAt");
    res.json(reports);
  } catch (err) {
    next(err);
  }
}

// PUT /api/admin/reports/:id   { status: "Reviewed" | "Dismissed", adminNote }
async function updateReportStatus(req, res, next) {
  try {
    const { status, adminNote } = req.body;
    if (!["Reviewed", "Dismissed"].includes(status)) {
      return res.status(400).json({ message: 'status must be "Reviewed" or "Dismissed"' });
    }

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status, ...(adminNote !== undefined ? { adminNote } : {}) },
      { new: true }
    );
    if (!report) return res.status(404).json({ message: "Report not found" });

    res.json(report);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProviders,
  verifyProvider,
  getKycSubmissions,
  reviewKyc,
  suspendProvider,
  unsuspendProvider,
  getReports,
  updateReportStatus,
};