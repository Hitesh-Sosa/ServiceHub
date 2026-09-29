const mongoose = require("mongoose");

// One payment per booking (unique). This record IS the shared payment proof.
const paymentSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, unique: true },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: ["card", "upi", "netbanking", "wallet", "cash"], default: "card" },
    // cash: "Pending" = customer claimed (photo uploaded), "Success" = provider confirmed too
    status: { type: String, enum: ["Pending", "Success", "Failed"], default: "Pending" },
    txnId: { type: String },
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String },

    // NEW: customer-uploaded photo of the cash handover (proof)
    cashProofPhotoUrl: { type: String, default: null },

    adminVoidReason: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);