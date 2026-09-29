const Kyc = require("../models/Kyc");
const User = require("../models/User");

// ============================================================
// PROVIDER: SUBMIT KYC
// POST /api/kyc
// ============================================================
async function submitKyc(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "ID document file is required (field name: document)",
      });
    }

    const { fullName, idType, idNumber } = req.body;

    if (!fullName || !idType || !idNumber) {
      return res.status(400).json({
        message: "fullName, idType and idNumber are required",
      });
    }

    const kyc = await Kyc.findOneAndUpdate(
      { provider: req.user._id },
      {
        fullName,
        idType,
        idNumber,
        documentUrl: `/uploads/kyc/${req.file.filename}`,

        // Every new submission goes back to Pending
        status: "Pending",

        // Clear previous rejection/review information
        rejectionReason: null,
        reviewedBy: null,
        reviewedAt: null,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    // Provider is NOT verified until admin approves the new submission.
    await User.findByIdAndUpdate(req.user._id, {
      isProviderVerified: false,
    });

    res.status(201).json({
      message: "KYC submitted. An admin will review it shortly.",
      kyc,
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// PROVIDER: GET OWN KYC
// GET /api/kyc/me
// ============================================================
async function getMyKyc(req, res, next) {
  try {
    const kyc = await Kyc.findOne({
      provider: req.user._id,
    }).populate("reviewedBy", "name email");

    if (!kyc) {
      return res.json({
        status: "NotSubmitted",
      });
    }

    res.json(kyc);
  } catch (err) {
    next(err);
  }
}

// ============================================================
// ADMIN: GET ALL KYC APPLICATIONS
// GET /api/kyc/admin/all
// ============================================================
async function getAllKycs(req, res, next) {
  try {
    const kycs = await Kyc.find()
      .populate("provider", "name email mobile role isProviderVerified accountStatus")
      .populate("reviewedBy", "name email")
      .sort({ createdAt: -1 });

    res.json({
      count: kycs.length,
      kycs,
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// ADMIN: APPROVE KYC
// PATCH /api/kyc/admin/:kycId/approve
// ============================================================
async function approveKyc(req, res, next) {
  try {
    const kyc = await Kyc.findById(req.params.kycId);

    if (!kyc) {
      return res.status(404).json({
        message: "KYC application not found",
      });
    }

    // Approve KYC
    kyc.status = "Approved";
    kyc.rejectionReason = null;
    kyc.reviewedBy = req.user._id;
    kyc.reviewedAt = new Date();

    await kyc.save();

    // IMPORTANT:
    // Provider becomes verified only after admin approval.
    const provider = await User.findByIdAndUpdate(
      kyc.provider,
      {
        isProviderVerified: true,
      },
      {
        new: true,
      }
    ).select("-password");

    res.json({
      message: "KYC approved successfully. Provider can now provide services.",
      kyc,
      provider,
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// ADMIN: REJECT KYC
// PATCH /api/kyc/admin/:kycId/reject
// ============================================================
async function rejectKyc(req, res, next) {
  try {
    const { rejectionReason } = req.body;

    const kyc = await Kyc.findById(req.params.kycId);

    if (!kyc) {
      return res.status(404).json({
        message: "KYC application not found",
      });
    }

    kyc.status = "Rejected";
    kyc.rejectionReason =
      rejectionReason || "KYC documents were rejected by admin.";
    kyc.reviewedBy = req.user._id;
    kyc.reviewedAt = new Date();

    await kyc.save();

    // Rejected provider cannot provide services.
    await User.findByIdAndUpdate(kyc.provider, {
      isProviderVerified: false,
    });

    res.json({
      message: "KYC rejected successfully.",
      kyc,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  submitKyc,
  getMyKyc,
  getAllKycs,
  approveKyc,
  rejectKyc,
};