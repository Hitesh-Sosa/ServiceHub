const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema(
  {
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    category: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    availability: {
      type: Boolean,
      default: true,
    },

    // Rating out of 10
    averageRating: {
      type: Number,
      default: 0,
    },

    // ---------------------------------------------------------
    // HUMAN-READABLE LOCATION
    // ---------------------------------------------------------
    location: {
      city: {
        type: String,
        trim: true,
      },

      area: {
        type: String,
        trim: true,
      },
    },

    // ---------------------------------------------------------
    // GEO LOCATION
    // ---------------------------------------------------------
    // This is completely separate from city/area.
    //
    // Example:
    // {
    //   type: "Point",
    //   coordinates: [72.8777, 22.6916]
    // }
    //
    // Coordinates are [longitude, latitude].
    // This field is optional.
    // ---------------------------------------------------------
    geoLocation: {
      type: {
        type: String,
        enum: ["Point"],
      },

      coordinates: {
        type: [Number],
      },
    },
  },
  {
    timestamps: true,
  }
);

// Text search
serviceSchema.index({
  category: "text",
  description: "text",
});

// Provider lookup
serviceSchema.index({
  provider: 1,
});

// IMPORTANT:
// GeoJSON index is ONLY on geoLocation.
serviceSchema.index({
  geoLocation: "2dsphere",
});

module.exports = mongoose.model("Service", serviceSchema);