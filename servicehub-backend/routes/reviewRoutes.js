const express = require("express");
const {
  getReviewsForProvider,
  submitReview,
  updateReview,
  deleteReview,
} = require("../controllers/reviewController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/:providerId", getReviewsForProvider); // public
router.post("/", protect, authorize("Customer"), submitReview);
router.put("/:id", protect, authorize("Customer"), updateReview);
router.delete("/:id", protect, deleteReview);

module.exports = router;
