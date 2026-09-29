const express = require("express");
const { getChatHistory, sendMessage } = require("../controllers/chatController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/:bookingId", protect, getChatHistory);
router.post("/:bookingId", protect, sendMessage);

module.exports = router;
