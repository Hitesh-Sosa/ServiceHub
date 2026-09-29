const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true } // createdAt doubles as the message timestamp
);

// NEW: history always queries "all messages of one booking, oldest first" -
// this index makes that fast as the chat grows.
chatMessageSchema.index({ booking: 1, createdAt: 1 });

module.exports = mongoose.model("ChatMessage", chatMessageSchema);