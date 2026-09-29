const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    reportedProvider: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null },
    reason: {
      type: String,
      enum: ["FakeProfile", "NoShow", "FraudPayment", "Misbehavior", "Other"],
      required: true,
    },
    details: { type: String, trim: true },
    status: { type: String, enum: ["Open", "Reviewed", "Dismissed"], default: "Open" },
    adminNote: { type: String },
  },
  { timestamps: true }
);

// one report per customer per provider
reportSchema.index({ reportedProvider: 1, reportedBy: 1 }, { unique: true });
// for the auto-suspend "recent reports" count
reportSchema.index({ reportedProvider: 1, createdAt: -1 });

module.exports = mongoose.model("Report", reportSchema);