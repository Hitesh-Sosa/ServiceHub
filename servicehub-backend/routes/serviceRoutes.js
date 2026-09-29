const express = require("express");

const {
  getAllServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  getMyServices,
} = require("../controllers/serviceController");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

const router = express.Router();

// ============================================================
// PUBLIC
// ============================================================

// Anyone can browse services
router.get("/", getAllServices);

// ============================================================
// PROVIDER - OWN LISTINGS
// ============================================================

// ⚠️ MUST be declared BEFORE "/:id" - otherwise Express matches the
// word "mine" as an :id and Mongoose throws:
// CastError: Cast to ObjectId failed for value "mine"
router.get("/mine", protect, authorize("Provider"), getMyServices);

// Anyone can view a service
router.get("/:id", getServiceById);

// ============================================================
// PROVIDER
// ============================================================

// Provider can create service only if:
// KYC = Approved
// isProviderVerified = true
// account is not suspended
router.post(
  "/",
  protect,
  authorize("Provider"),
  createService
);

// Provider can update own service
router.put(
  "/:id",
  protect,
  authorize("Provider"),
  updateService
);

// Provider can delete own service
// Admin can also delete service
router.delete(
  "/:id",
  protect,
  authorize("Provider", "Admin"),
  deleteService
);

module.exports = router;