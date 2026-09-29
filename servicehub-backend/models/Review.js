const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    provider: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // NEW: the specific service that was rated, so each SERVICE gets its own
    // average rating on top of the provider-wide one.
    service: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
    // CHANGED: ratings are OUT OF 10 (was 1-5).
    rating: { type: Number, required: true, min: 1, max: 10 },
    comment: { type: String, trim: true },
  },
  { timestamps: true }
);

reviewSchema.index({ provider: 1, createdAt: -1 });
reviewSchema.index({ service: 1, createdAt: -1 }); // NEW: per-service average recompute

module.exports = mongoose.model("Review", reviewSchema);