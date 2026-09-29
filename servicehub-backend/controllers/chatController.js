const ChatMessage = require("../models/ChatMessage");
const Booking = require("../models/Booking");

async function assertParticipant(bookingId, userId) {
  const booking = await Booking.findById(bookingId);
  if (!booking) return { ok: false, code: 404, message: "Booking not found" };
  const isParticipant =
    booking.customer.toString() === userId.toString() || booking.provider.toString() === userId.toString();
  if (!isParticipant) return { ok: false, code: 403, message: "You are not part of this booking" };
  return { ok: true, booking };
}

// GET /api/chat/:bookingId
async function getChatHistory(req, res, next) {
  try {
    const check = await assertParticipant(req.params.bookingId, req.user._id);
    if (!check.ok) return res.status(check.code).json({ message: check.message });

    const messages = await ChatMessage.find({ booking: req.params.bookingId })
      .populate("sender", "name")
      .sort("createdAt");
    res.json(messages);
  } catch (err) {
    next(err);
  }
}

// POST /api/chat/:bookingId  (REST endpoint; delivery to OTHER participants
// is real-time via Socket.io broadcast from here)
async function sendMessage(req, res, next) {
  try {
    const check = await assertParticipant(req.params.bookingId, req.user._id);
    if (!check.ok) return res.status(check.code).json({ message: check.message });

    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ message: "content is required" });

    const message = await ChatMessage.create({
      booking: req.params.bookingId,
      sender: req.user._id,
      content: content.trim(),
    });

    // populate sender name BEFORE broadcasting, so receivers see the
    // real name in the live message (the raw doc only has the ObjectId).
    await message.populate("sender", "name");

    const io = req.app.get("io");
    if (io) io.to(`booking_${req.params.bookingId}`).emit("newMessage", message);

    // NEW: return the populated message too. If the SENDER's socket is
    // disconnected, the broadcast never reaches their own browser - the
    // frontend appends this `data` instead, so their own message never
    // disappears until refresh.
    res.status(201).json({ message: "Message sent", messageId: message._id, data: message });
  } catch (err) {
    next(err);
  }
}

module.exports = { getChatHistory, sendMessage };