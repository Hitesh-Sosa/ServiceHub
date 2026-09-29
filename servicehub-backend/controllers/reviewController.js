const Review = require("../models/Review");
const Booking = require("../models/Booking");
const Service = require("../models/Service");
const User = require("../models/User");

// Recalculate BOTH averages after any review change (F5) - out of 10.
// Averages are stored rounded to 1 decimal (e.g. 5.8), because the mean
// of 0.5-step ratings can itself be between steps (e.g. (6 + 5.5) / 2 = 5.8).
async function recalcRatings(serviceId, providerId) {
  const svcStats = await Review.aggregate([
    { $match: { service: serviceId } },
    { $group: { _id: "$service", avg: { $avg: "$rating" } } },
  ]);
  const serviceAvg = svcStats.length ? Math.round(svcStats[0].avg * 10) / 10 : 0;
  await Service.findByIdAndUpdate(serviceId, { averageRating: serviceAvg });

  const provStats = await Review.aggregate([
    { $match: { provider: providerId } },
    { $group: { _id: "$provider", avg: { $avg: "$rating" } } },
  ]);
  const providerAvg = provStats.length ? Math.round(provStats[0].avg * 10) / 10 : 0;
  await User.findByIdAndUpdate(providerId, { averageRating: providerAvg });
}

// GET /api/reviews/:providerId
async function getReviewsForProvider(req, res, next) {
  try {
    const reviews = await Review.find({ provider: req.params.providerId })
      .populate("customer", "name")
      .populate("service", "category")
      .sort("-createdAt");
    res.json(reviews);
  } catch (err) {
    next(err);
  }
}

// NEW: ratings are given in 0.5 STEPS between 0.5 and 10
// (0.5, 1, 1.5, 2 ... 9.5, 10). Examples: 5.5 ✓  3.5 ✓  7.3 ✗  0 ✗  10 ✓
// The (n * 2) % 1 === 0 check means "n is a multiple of 0.5".
// 0 is NOT allowed on purpose: averageRating 0 means "New / unrated"
// for a service - a 0 rating would make "unrated" and "rated 0"
// indistinguishable.
function validRating(rating) {
  const n = Number(rating);
  return Number.isFinite(n) && n >= 0.5 && n <= 10 && (n * 2) % 1 === 0;
}

// POST /api/reviews
// Gate: only after the work is Completed AND paid (anti-fake-review).
async function submitReview(req, res, next) {
  try {
    const { bookingId, rating, comment } = req.body;
    if (!bookingId && rating === undefined) {
      return res.status(400).json({ message: "bookingId and rating are required" });
    }
    if (!bookingId) {
      return res.status(400).json({ message: "bookingId and rating are required" });
    }
    if (!validRating(rating)) {
      return res.status(400).json({
        message: "Rating must be between 0.5 and 10 in steps of 0.5 (e.g. 5.5, 7, 9.5)",
      });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You can only review your own bookings" });
    }
    if (booking.status !== "Completed") {
      return res.status(400).json({ message: 'Review is only allowed after status is "Completed"' });
    }
    if (booking.paymentStatus !== "Paid") {
      return res.status(400).json({ message: "Review is only allowed after the payment is completed" });
    }

    const review = await Review.create({
      booking: bookingId,
      customer: req.user._id,
      provider: booking.provider,
      service: booking.service,
      rating: Number(rating),
      comment,
    });

    await recalcRatings(booking.service, booking.provider);
    res.status(201).json({ message: "Review submitted successfully", reviewId: review._id });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "A review already exists for this booking" });
    }
    next(err);
  }
}

// PUT /api/reviews/:id
async function updateReview(req, res, next) {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: "Review not found" });
    if (review.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You can only edit your own review" });
    }
    const { rating, comment } = req.body;
    if (rating !== undefined) {
      if (!validRating(rating)) {
        return res.status(400).json({
          message: "Rating must be between 0.5 and 10 in steps of 0.5 (e.g. 5.5, 7, 9.5)",
        });
      }
      review.rating = Number(rating);
    }
    if (comment !== undefined) review.comment = comment;
    await review.save();
    await recalcRatings(review.service, review.provider);
    res.json({ message: "Review updated successfully" });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/reviews/:id
async function deleteReview(req, res, next) {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: "Review not found" });
    if (review.customer.toString() !== req.user._id.toString() && req.user.role !== "Admin") {
      return res.status(403).json({ message: "You can only delete your own review" });
    }
    const serviceId = review.service;
    const providerId = review.provider;
    await review.deleteOne();
    await recalcRatings(serviceId, providerId);
    res.json({ message: "Review deleted successfully" });
  } catch (err) {
    next(err);
  }
}

module.exports = { getReviewsForProvider, submitReview, updateReview, deleteReview };