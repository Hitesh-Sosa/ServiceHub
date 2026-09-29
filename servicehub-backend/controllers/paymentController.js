const crypto = require("crypto");
const Razorpay = require("razorpay");
const Payment = require("../models/Payment");
const Booking = require("../models/Booking");
const User = require("../models/User");

let razorpay = null;
function getRazorpay() {
  if (razorpay) return razorpay;
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay keys are not configured in .env");
  }
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  return razorpay;
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

function emitBookingUpdate(req, booking) {
  const io = req.app.get("io");
  if (io) {
    io.to(`booking_${booking._id}`).emit("bookingStatus", {
      bookingId: booking._id,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      providerConfirmedCompletion: booking.providerConfirmedCompletion,
      customerConfirmedCompletion: booking.customerConfirmedCompletion,
      customerPaymentConfirmed: booking.customerPaymentConfirmed,
      providerPaymentConfirmed: booking.providerPaymentConfirmed,
    });
  }
}

// ============================================================
// POST /api/payments/order  (online - unchanged)
// ============================================================
async function createOrder(req, res, next) {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ message: "bookingId is required" });

    const booking = await Booking.findById(bookingId).populate("service", "price");
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You can only pay for your own bookings" });
    }
    if (booking.status !== "Completed") {
      return res.status(400).json({
        message: `Payment is allowed only after the work is Completed (current status: ${booking.status})`,
      });
    }
    if (booking.paymentStatus === "Paid") {
      return res.status(400).json({ message: "This booking is already paid" });
    }

    const provider = await User.findById(booking.provider).select("isProviderVerified accountStatus");
    if (!provider || !provider.isProviderVerified) {
      return res.status(403).json({ message: "This provider is not verified. Payment blocked." });
    }
    if (provider.accountStatus === "Suspended") {
      return res.status(403).json({ message: "This provider is suspended. Payment blocked." });
    }

    const amountRupees = booking.service.price;
    const order = await getRazorpay().orders.create({
      amount: Math.round(amountRupees * 100),
      currency: "INR",
      receipt: `bkng_${booking._id.toString()}`,
    });

    let payment = await Payment.findOne({ booking: booking._id });
    if (payment && payment.status === "Success") {
      return res.status(400).json({ message: "This booking is already paid" });
    }
    if (payment) {
      payment.razorpayOrderId = order.id;
      payment.amount = amountRupees;
      payment.status = "Pending";
      payment.method = "upi";
      await payment.save();
    } else {
      payment = await Payment.create({
        booking: booking._id,
        amount: amountRupees,
        razorpayOrderId: order.id,
      });
    }

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// POST /api/payments/verify  (online - unchanged)
// ============================================================
async function verifyPayment(req, res, next) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        message: "razorpay_order_id, razorpay_payment_id and razorpay_signature are required",
      });
    }

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (!safeEqual(expected, razorpay_signature)) {
      return res.status(400).json({ message: "Invalid payment signature. Payment NOT verified." });
    }

    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
    if (!payment) return res.status(404).json({ message: "No payment record for this order" });

    const booking = await Booking.findById(payment.booking);
    if (!booking || booking.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You can only verify payments for your own bookings" });
    }

    if (payment.status !== "Success") {
      payment.status = "Success";
      payment.razorpayPaymentId = razorpay_payment_id;
      payment.txnId = razorpay_payment_id;
      await payment.save();

      // online = gateway-verified proof: Paid immediately (no cash-style
      // confirmation needed - Razorpay IS the proof)
      booking.paymentStatus = "Paid";
      booking.paidAt = new Date();
      await booking.save();

      emitBookingUpdate(req, booking);
    }

    res.json({
      message: "Payment verified. Thank you!",
      paymentId: payment._id,
      txnId: payment.txnId,
      paymentStatus: booking.paymentStatus,
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// POST /api/payments/cash   (multipart: photo)
// STEP 1 of cash proof - CUSTOMER ONLY, STRICT ORDER:
// Customer uploads the handover photo and presses "Payment completed".
// This creates the Payment record (status Pending) + sets
// customerPaymentConfirmed. The PROVIDER cannot confirm before this.
// ============================================================
async function claimCashPayment(req, res, next) {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ message: "bookingId is required" });

    const booking = await Booking.findById(bookingId).populate("service", "price");
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the customer of this booking can mark cash payment" });
    }
    if (booking.status !== "Completed") {
      return res.status(400).json({
        message: `Cash payment can be recorded only after the work is Completed (current status: ${booking.status})`,
      });
    }
    if (booking.paymentStatus === "Paid") {
      return res.status(400).json({ message: "This booking is already paid" });
    }
    if (booking.customerPaymentConfirmed) {
      return res.status(400).json({
        message: "You already marked 'Payment completed'. Waiting for the PROVIDER to confirm.",
      });
    }
    if (!req.file) {
      return res.status(400).json({ message: "Cash handover photo is required (field name: photo)" });
    }

    const txnId = "CASH-" + crypto.randomBytes(4).toString("hex").toUpperCase();
    const photoUrl = `/uploads/payments/${req.file.filename}`;

    let payment = await Payment.findOne({ booking: booking._id });
    if (payment && payment.status === "Success") {
      return res.status(400).json({ message: "This booking is already paid" });
    }
    if (payment) {
      payment.method = "cash";
      payment.amount = booking.service.price;
      payment.status = "Pending";
      payment.txnId = txnId;
      payment.cashProofPhotoUrl = photoUrl;
      await payment.save();
    } else {
      payment = await Payment.create({
        booking: booking._id,
        amount: booking.service.price,
        method: "cash",
        status: "Pending",
        txnId,
        cashProofPhotoUrl: photoUrl,
      });
    }

    booking.customerPaymentConfirmed = true;
    await booking.save();

    emitBookingUpdate(req, booking);

    res.status(201).json({
      message:
        "You marked 'Payment completed' with photo proof. Waiting for the PROVIDER to press 'Payment completed'.",
      payment: { id: payment._id, method: payment.method, txnId: payment.txnId, status: payment.status },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "A payment already exists for this booking" });
    }
    next(err);
  }
}

// ============================================================
// PUT /api/payments/cash/:bookingId/confirm
// STEP 2 of cash proof - PROVIDER ONLY, STRICT ORDER:
// BLOCKED with 403 until the customer has confirmed (with photo).
// When both are confirmed -> paymentStatus = "Paid" -> review unlocked.
// ============================================================
async function confirmCashPayment(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    if (booking.provider.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the provider of this booking can confirm cash receipt" });
    }
    if (booking.status !== "Completed") {
      return res.status(400).json({
        message: `Confirmation is allowed only after the work is Completed (current status: ${booking.status})`,
      });
    }
    if (booking.paymentStatus === "Paid") {
      return res.status(400).json({ message: "This booking is already paid" });
    }

    // ==== STRICT ORDER - CUSTOMER IS THE GATEKEEPER ====
    if (!booking.customerPaymentConfirmed) {
      return res.status(403).json({
        message:
          "BLOCKED: the CUSTOMER must press 'Payment completed' FIRST (with the handover photo). Only then can you confirm.",
        customerPaymentConfirmed: booking.customerPaymentConfirmed,
      });
    }
    if (booking.providerPaymentConfirmed) {
      return res.status(400).json({ message: "You already pressed 'Payment completed'." });
    }

    booking.providerPaymentConfirmed = true;

    const payment = await Payment.findOne({ booking: booking._id });
    if (!payment) {
      return res.status(404).json({ message: "No cash claim found for this booking" });
    }

    payment.status = "Success";
    await payment.save();

    booking.paymentStatus = "Paid";
    booking.paidAt = new Date();
    await booking.save();

    emitBookingUpdate(req, booking);

    res.json({
      message: "Payment completed by BOTH sides. Receipt is now proof for both - the customer can now rate the work.",
      paymentStatus: booking.paymentStatus,
      txnId: payment.txnId,
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// GET /api/payments/booking/:bookingId  (shared receipt - unchanged)
// ============================================================
async function getPaymentByBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const userId = req.user._id.toString();
    const isParticipant =
      booking.customer.toString() === userId || booking.provider.toString() === userId;
    if (!isParticipant && req.user.role !== "Admin") {
      return res.status(403).json({ message: "You are not part of this booking" });
    }

    const payment = await Payment.findOne({ booking: booking._id });
    res.json(payment);
  } catch (err) {
    next(err);
  }
}

// ============================================================
// POST /api/payments/webhook  (unchanged)
// ============================================================
async function razorpayWebhook(req, res, next) {
  try {
    const signature = req.headers["x-razorpay-signature"];
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
      return res.status(500).json({ message: "Webhook secret not configured" });
    }

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(req.body)
      .digest("hex");

    if (!signature || !safeEqual(expected, signature)) {
      return res.status(400).json({ message: "Invalid webhook signature" });
    }

    const event = JSON.parse(req.body.toString("utf8"));

    if (event.event === "payment.captured") {
      const ent = event.payload.payment.entity;
      const payment = await Payment.findOne({ razorpayOrderId: ent.order_id });
      if (payment && payment.status !== "Success") {
        payment.status = "Success";
        payment.razorpayPaymentId = ent.id;
        payment.txnId = ent.id;
        await payment.save();
        await Booking.findByIdAndUpdate(payment.booking, {
          paymentStatus: "Paid",
          paidAt: new Date(),
        });
      }
    }

    if (event.event === "payment.failed") {
      const ent = event.payload.payment.entity;
      await Payment.findOneAndUpdate({ razorpayOrderId: ent.order_id }, { status: "Failed" });
    }

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
}

// GET /api/payments/:id  (unchanged)
async function getPaymentById(req, res, next) {
  try {
    const payment = await Payment.findById(req.params.id).populate("booking");
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    const booking = payment.booking;
    if (booking) {
      const userId = req.user._id.toString();
      const isParticipant =
        booking.customer.toString() === userId || booking.provider.toString() === userId;
      if (!isParticipant && req.user.role !== "Admin") {
        return res.status(403).json({ message: "You are not part of this booking" });
      }
    }

    res.json(payment);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createOrder,
  verifyPayment,
  claimCashPayment,
  confirmCashPayment,
  getPaymentByBooking,
  razorpayWebhook,
  getPaymentById,
};