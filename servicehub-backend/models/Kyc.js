const mongoose = require("mongoose");

// One KYC submission per provider.
// Resubmission overwrites the previous KYC and resets status to Pending.
const kycSchema = new mongoose.Schema(
  {
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    idType: {
      type: String,
      enum: ["Aadhaar", "PAN", "Passport", "DrivingLicense"],
      required: true,
    },

    idNumber: {
      type: String,
      required: true,
      trim: true,
    },

    documentUrl: {
      type: String,
      required: true,
    },

    // Pending -> Admin has not reviewed
    // Approved -> Admin approved provider
    // Rejected -> Admin rejected provider
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },

    rejectionReason: {
      type: String,
      default: null,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Kyc", kycSchema);