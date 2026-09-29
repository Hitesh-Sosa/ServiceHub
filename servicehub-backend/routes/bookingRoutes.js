const express = require("express");
const {
  getBookings,
  getBookingById,
  createBooking,
  updateBookingStatus,
  confirmCompletion,
  cancelBooking,
} = require("../controllers/bookingController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, getBookings);
router.get("/:id", protect, getBookingById);
router.post("/", protect, authorize("Customer"), createBooking);
router.put("/:id", protect, updateBookingStatus);
// NEW: two-sided completion - customer FIRST, provider second
router.put("/:id/confirm-completion", protect, confirmCompletion);
router.delete("/:id", protect, authorize("Customer"), cancelBooking);

module.exports = router;