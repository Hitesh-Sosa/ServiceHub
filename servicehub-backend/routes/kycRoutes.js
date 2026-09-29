const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

const {
  submitKyc,
  getMyKyc,
  getAllKycs,
  approveKyc,
  rejectKyc,
} = require("../controllers/kycController");

const router = express.Router();

// ============================================================
// KYC UPLOAD FOLDER
// ============================================================

fs.mkdirSync(
  path.join(__dirname, "..", "uploads", "kyc"),
  {
    recursive: true,
  }
);

// ============================================================
// MULTER CONFIGURATION
// ============================================================

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(
        null,
        path.join(__dirname, "..", "uploads", "kyc")
      );
    },

    filename: (req, file, cb) => {
      cb(
        null,
        `${req.user._id}-${Date.now()}${path.extname(
          file.originalname
        )}`
      );
    },
  }),

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "application/pdf",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Only JPG, JPEG, PNG and PDF files are allowed."
        )
      );
    }
  },
});

// ============================================================
// PROVIDER ROUTES
// ============================================================

// Submit / resubmit KYC
router.post(
  "/",
  protect,
  authorize("Provider"),
  upload.single("document"),
  submitKyc
);

// Get own KYC status
router.get(
  "/me",
  protect,
  authorize("Provider"),
  getMyKyc
);

// ============================================================
// ADMIN ROUTES
// ============================================================

// Get all KYC applications
router.get(
  "/admin/all",
  protect,
  authorize("Admin"),
  getAllKycs
);

// Approve KYC
router.patch(
  "/admin/:kycId/approve",
  protect,
  authorize("Admin"),
  approveKyc
);

// Reject KYC
router.patch(
  "/admin/:kycId/reject",
  protect,
  authorize("Admin"),
  rejectKyc
);

module.exports = router;