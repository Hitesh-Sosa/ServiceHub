const Booking = require("../models/Booking");
const Service = require("../models/Service");
const User = require("../models/User");

function emitBookingUpdate(req, booking) {
  const io = req.app.get("io");
  if (io) {
    io.to(`booking_${booking._id}`).emit("bookingStatus", {
      bookingId: booking._id,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      providerConfirmedCompletion: booking.providerConfirmedCompletion,
      customerConfirmedCompletion: booking.customerConfirmedCompletion,
    });
  }
}

// GET /api/bookings
async function getBookings(req, res, next) {
  try {
    const filter =
      req.user.role === "Customer"
        ? { customer: req.user._id }
        : req.user.role === "Provider"
        ? { provider: req.user._id }
        : {};

    const bookings = await Booking.find(filter)
      .populate("service", "category price location")
      .populate("customer", "name")
      .populate("provider", "name")
      .sort("-createdAt");
    res.json(bookings);
  } catch (err) {
    next(err);
  }
}

// GET /api/bookings/:id
async function getBookingById(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("service")
      .populate("customer", "name")
      .populate("provider", "name");
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const userId = req.user._id.toString();
    const isParticipant =
      booking.customer._id.toString() === userId || booking.provider._id.toString() === userId;
    if (!isParticipant && req.user.role !== "Admin") {
      return res.status(403).json({ message: "You are not part of this booking" });
    }

    res.json(booking);
  } catch (err) {
    next(err);
  }
}

// POST /api/bookings
async function createBooking(req, res, next) {
  try {
    const { serviceId, dateTime, address } = req.body;
    if (!serviceId || !dateTime || !address) {
      return res.status(400).json({ message: "serviceId, dateTime and address are required" });
    }

    const when = new Date(dateTime);
    if (isNaN(when.getTime())) {
      return res.status(400).json({ message: "dateTime must be a valid date" });
    }
    if (when < new Date()) {
      return res.status(400).json({ message: "Booking date/time must be in the future" });
    }

    const service = await Service.findById(serviceId);
    if (!service) return res.status(404).json({ message: "Service not found" });
    if (!service.availability) {
      return res.status(400).json({ message: "This service is currently unavailable" });
    }

    const provider = await User.findById(service.provider).select("isProviderVerified accountStatus");
    if (!provider || !provider.isProviderVerified) {
      return res.status(403).json({ message: "This provider is not verified and cannot accept bookings" });
    }
    if (provider.accountStatus === "Suspended") {
      return res.status(403).json({ message: "This provider is not accepting bookings" });
    }

    const booking = await Booking.create({
      customer: req.user._id,
      provider: service.provider,
      service: service._id,
      dateTime: when,
      address,
      status: "Pending",
    });

    res.status(201).json({ message: "Booking created", bookingId: booking._id, status: booking.status });
  } catch (err) {
    next(err);
  }
}

// PUT /api/bookings/:id
// "Completed" can NEVER be set through this route - not by customer, not by
// provider, not even by Postman. The ONLY path to Completed is
// /confirm-completion, and there the CUSTOMER must confirm FIRST.
async function updateBookingStatus(req, res, next) {
  try {
    const { status } = req.body;
    const allowed = ["Confirmed", "Rejected", "Cancelled"];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        message:
          "Setting status to Completed directly is BLOCKED. The customer must confirm completion first, then the provider. Allowed here: Confirmed, Rejected, Cancelled",
      });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const userId = req.user._id.toString();
    const isCustomer = booking.customer.toString() === userId;
    const isProvider = booking.provider.toString() === userId;
    const isAdmin = req.user.role === "Admin";

    if (!isCustomer && !isProvider && !isAdmin) {
      return res.status(403).json({ message: "You are not part of this booking" });
    }

    if (!isAdmin) {
      if (isCustomer && status !== "Cancelled") {
        return res.status(403).json({ message: "Customers can only cancel a booking" });
      }
      if (isProvider && !["Confirmed", "Rejected"].includes(status)) {
        return res.status(403).json({ message: "Providers can only accept or reject a booking" });
      }
    }

    const transitions = {
      Pending: ["Confirmed", "Rejected", "Cancelled"],
      Confirmed: ["Cancelled"],
      Rejected: [],
      Completed: [],
      Cancelled: [],
    };
    if (!transitions[booking.status].includes(status)) {
      return res
        .status(400)
        .json({ message: `Cannot move a booking from "${booking.status}" to "${status}"` });
    }

    booking.status = status;
    await booking.save();

    emitBookingUpdate(req, booking);

    res.json({
      message: "Booking status updated",
      status: booking.status,
      paymentStatus: booking.paymentStatus,
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/bookings/:id/confirm-completion
// STRICT ORDER - THE CUSTOMER IS THE GATEKEEPER:
//   Provider calling this BEFORE the customer confirmed -> 403 REJECTED.
//   This is true even if the provider calls the API directly (Postman),
//   because the guard is here on the server, not in the UI.
async function confirmCompletion(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const userId = req.user._id.toString();
    const isCustomer = booking.customer.toString() === userId;
    const isProvider = booking.provider.toString() === userId;
    const isAdmin = req.user.role === "Admin";

    if (!isCustomer && !isProvider && !isAdmin) {
      return res.status(403).json({ message: "You are not part of this booking" });
    }

    if (booking.paymentStatus === "Paid") {
      return res.status(400).json({ message: "This booking is already completed and paid" });
    }
    if (!["Confirmed", "Completed"].includes(booking.status)) {
      return res.status(400).json({
        message: `Completion can only be confirmed while the booking is Confirmed (current status: ${booking.status})`,
      });
    }

    // ================= THE CORE RULE =================
    // Provider can NEVER confirm before the customer has confirmed.
    if (isProvider && !booking.customerConfirmedCompletion) {
      return res.status(403).json({
        message:
          "BLOCKED: the CUSTOMER must confirm the work is completed FIRST. Only after the customer confirms can you mark it completed.",
        customerConfirmedCompletion: booking.customerConfirmedCompletion,
      });
    }
    // =================================================

    if (isAdmin) {
      booking.providerConfirmedCompletion = true;
      booking.customerConfirmedCompletion = true;
    } else if (isProvider) {
      booking.providerConfirmedCompletion = true;
    } else {
      booking.customerConfirmedCompletion = true;
    }

    if (booking.providerConfirmedCompletion && booking.customerConfirmedCompletion) {
      booking.status = "Completed";
      if (!booking.completedAt) booking.completedAt = new Date();
    }

    await booking.save();
    emitBookingUpdate(req, booking);

    let message;
    if (booking.status === "Completed") {
      message = "Both sides confirmed. Work completed - the customer can now pay.";
    } else if (isCustomer) {
      message = "You confirmed the work is completed. The PROVIDER can now mark it completed.";
    } else {
      message = "Completion recorded.";
    }

    res.json({
      message,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      providerConfirmedCompletion: booking.providerConfirmedCompletion,
      customerConfirmedCompletion: booking.customerConfirmedCompletion,
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/bookings/:id
async function cancelBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.status !== "Pending") {
      return res.status(400).json({ message: "Only Pending bookings can be cancelled this way" });
    }
    if (booking.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You can only cancel your own bookings" });
    }
    await booking.deleteOne();
    res.json({ message: "Booking cancelled successfully" });
  } catch (err) {
    next(err);
  }
}

module.exports = { getBookings, getBookingById, createBooking, updateBookingStatus, confirmCompletion, cancelBooking };