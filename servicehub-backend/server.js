require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const path = require("path");
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const Booking = require("./models/Booking");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const { razorpayWebhook } = require("./controllers/paymentController");

// Import Route Handlers
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const chatRoutes = require("./routes/chatRoutes");
const adminRoutes = require("./routes/adminRoutes");
const kycRoutes = require("./routes/kycRoutes");
const reportRoutes = require("./routes/reportRoutes");
const googleAuthRoutes = require("./routes/googleAuth");

// Initialize Express App & Connect Database
const app = express();
connectDB();

// ---------------- SECURITY MIDDLEWARE ----------------

app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
  })
);

// ---------------- RAZORPAY WEBHOOK ----------------
// MUST come before express.json()
app.post(
  "/api/payments/webhook",
  express.raw({ type: "*/*" }),
  razorpayWebhook
);

// ---------------- BODY PARSER ----------------

app.use(express.json({ limit: "10kb" }));

app.use(mongoSanitize());

// ---------------- STATIC FILES ----------------

app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);

// ---------------- HEALTH CHECK ----------------

app.get("/", (req, res) => {
  res.json({
    message: "ServiceHub API is running",
  });
});

// ---------------- API ROUTES ----------------

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/reports", reportRoutes);

// Google Authentication
app.use(googleAuthRoutes);

// ---------------- SOCKET.IO ----------------

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
  },
});

app.set("io", io);

// Socket authentication
io.use((socket, next) => {
  const token =
    socket.handshake.auth &&
    socket.handshake.auth.token;

  if (!token) {
    return next(new Error("Authentication required"));
  }

  try {
    socket.user = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET
    );

    next();
  } catch {
    next(new Error("Invalid or expired token"));
  }
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("joinBooking", async (bookingId) => {
    try {
      const booking = await Booking.findById(bookingId);

      if (!booking) return;

      const userId = socket.user.id;

      const isParticipant =
        booking.customer.toString() === userId ||
        booking.provider.toString() === userId;

      if (!isParticipant) return;

      socket.join(`booking_${bookingId}`);
    } catch {
      // Ignore invalid booking ID
    }
  });

  socket.on("sendMessage", ({ bookingId, message }) => {
    io.to(`booking_${bookingId}`).emit(
      "newMessage",
      message
    );
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

// ---------------- ERROR HANDLING ----------------

app.use(notFound);
app.use(errorHandler);

// ---------------- START SERVER ----------------

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(
    `ServiceHub API listening on http://localhost:${PORT}`
  );
});