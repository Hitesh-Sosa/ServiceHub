const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  createOrder,
  verifyPayment,
  claimCashPayment,
  confirmCashPayment,
  getPaymentByBooking,
  getPaymentById,
} = require("../controllers/paymentController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// cash handover photos
fs.mkdirSync(path.join(__dirname, "..", "uploads", "payments"), { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, "..", "uploads", "payments")),
    filename: (req, file, cb) =>
      cb(null, `cash-${req.user._id}-${Date.now()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /image\/(jpe?g|png)/.test(file.mimetype)),
});

// POST /api/payments/webhook is mounted directly in server.js (raw body).

router.post("/order", protect, authorize("Customer"), createOrder);
router.post("/verify", protect, authorize("Customer"), verifyPayment);
router.post("/cash", protect, authorize("Customer"), upload.single("photo"), claimCashPayment);
router.put("/cash/:bookingId/confirm", protect, authorize("Provider"), confirmCashPayment);
router.get("/booking/:bookingId", protect, getPaymentByBooking);
router.get("/:id", protect, getPaymentById);

module.exports = router;