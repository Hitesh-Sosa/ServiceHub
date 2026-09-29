const express = require("express");
const {
  getProviders,
  verifyProvider,
  getKycSubmissions,
  reviewKyc,
  suspendProvider,
  unsuspendProvider,
  getReports,
  updateReportStatus,
} = require("../controllers/adminController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, authorize("Admin"));

// providers
router.get("/providers", getProviders);
router.put("/providers/:id/verify", verifyProvider);
router.put("/providers/:id/suspend", suspendProvider);
router.put("/providers/:id/unsuspend", unsuspendProvider);

// kyc
router.get("/kyc", getKycSubmissions);
router.put("/kyc/:id/review", reviewKyc);

// reports
router.get("/reports", getReports);
router.put("/reports/:id", updateReportStatus);

module.exports = router;