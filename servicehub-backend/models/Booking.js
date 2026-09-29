const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    provider: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
    dateTime: { type: Date, required: true },
    address: { type: String, required: true },
    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Rejected", "Completed", "Cancelled"],
      default: "Pending",
    },

    // two-sided WORK completion (customer FIRST, provider second)
    providerConfirmedCompletion: { type: Boolean, default: false },
    customerConfirmedCompletion: { type: Boolean, default: false },

    // two-sided CASH PAYMENT confirmation (customer FIRST with photo, provider second)
    customerPaymentConfirmed: { type: Boolean, default: false },
    providerPaymentConfirmed: { type: Boolean, default: false },

    paymentStatus: { type: String, enum: ["Unpaid", "Paid"], default: "Unpaid" },
    completedAt: { type: Date },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

bookingSchema.index({ customer: 1, createdAt: -1 });
bookingSchema.index({ provider: 1, createdAt: -1 });

module.exports = mongoose.model("Booking", bookingSchema);