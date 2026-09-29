const Service = require("../models/Service");
const User = require("../models/User");
const Kyc = require("../models/Kyc");

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ============================================================
// PARSE LOCATION
// ============================================================

function parseLocation(location) {
  if (!location) {
    return {
      ok: true,
      value: undefined,
    };
  }

  const value = {};

  if (location.city !== undefined) {
    value.city = String(location.city).trim();
  }

  if (location.area !== undefined) {
    value.area = String(location.area).trim();
  }

  return {
    ok: true,
    value,
  };
}

// ============================================================
// PARSE GEO LOCATION
// ============================================================

function parseGeoLocation(location) {
  if (
    !location ||
    location.coordinates === undefined ||
    location.coordinates === null
  ) {
    return {
      ok: true,
      value: undefined,
    };
  }

  if (
    !Array.isArray(location.coordinates) ||
    location.coordinates.length !== 2
  ) {
    return {
      ok: false,
      message:
        "location.coordinates must be [longitude, latitude]",
    };
  }

  const [lng, lat] = location.coordinates.map(Number);

  if (
    !Number.isFinite(lng) ||
    !Number.isFinite(lat) ||
    Math.abs(lng) > 180 ||
    Math.abs(lat) > 90
  ) {
    return {
      ok: false,
      message:
        "location.coordinates has invalid values (lng: -180..180, lat: -90..90)",
    };
  }

  return {
    ok: true,
    value: {
      type: "Point",
      coordinates: [lng, lat],
    },
  };
}

// ============================================================
// VERIFIED PROVIDERS
// ============================================================

async function getVerifiedProviderIds() {
  const providers = await User.find({
    role: "Provider",
    isProviderVerified: true,
    accountStatus: {
      $ne: "Suspended",
    },
  }).select("_id");

  return providers.map((p) => p._id);
}

// ============================================================
// GET ALL SERVICES
// ============================================================

async function getAllServices(req, res, next) {
  try {
    const {
      category,
      rating,
      q,
      lat,
      lng,
      sortBy,
    } = req.query;

    const latNum = Number(lat);
    const lngNum = Number(lng);

    const geoValid =
      lat !== undefined &&
      lng !== undefined &&
      !isNaN(latNum) &&
      !isNaN(lngNum) &&
      Math.abs(latNum) <= 90 &&
      Math.abs(lngNum) <= 180;

    const baseFilter = {};

    if (category) {
      baseFilter.category = new RegExp(
        escapeRegex(category),
        "i"
      );
    }

    if (rating) {
      baseFilter.averageRating = {
        $gte: Number(rating),
      };
    }

    baseFilter.provider = {
      $in: await getVerifiedProviderIds(),
    };

    let services;

    if (geoValid) {
      const pipeline = [
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [lngNum, latNum],
            },

            distanceField: "distance",

            spherical: true,

            key: "geoLocation",

            query: {
              ...baseFilter,

              geoLocation: {
                $exists: true,
              },
            },
          },
        },

        {
          $addFields: {
            distanceKm: {
              $round: [
                {
                  $divide: ["$distance", 1000],
                },
                2,
              ],
            },
          },
        },
      ];

      if (q) {
        pipeline.push({
          $match: {
            $text: {
              $search: q,
            },
          },
        });
      }

      pipeline.push({
        $sort:
          sortBy === "rating"
            ? { averageRating: -1 }
            : { distance: 1 },
      });

      pipeline.push(
        {
          $lookup: {
            from: "users",
            localField: "provider",
            foreignField: "_id",
            as: "provider",
          },
        },

        {
          $unwind: "$provider",
        },

        {
          $project: {
            "provider.password": 0,
            "provider.mobileEncrypted": 0,
            "provider.mobileHash": 0,
            "provider.otpHash": 0,
            "provider.otpExpiresAt": 0,
          },
        }
      );

      services = await Service.aggregate(pipeline);
    } else {
      const filter = {
        ...baseFilter,
      };

      if (q) {
        filter.$text = {
          $search: q,
        };
      }

      let query = Service.find(filter).populate(
        "provider",
        "name isProviderVerified averageRating"
      );

      if (sortBy === "rating") {
        query = query.sort({
          averageRating: -1,
        });
      } else {
        query = query.sort("-createdAt");
      }

      services = await query;
    }

    res.json(services);
  } catch (err) {
    next(err);
  }
}

// ============================================================
// GET SERVICE BY ID
// ============================================================

async function getServiceById(req, res, next) {
  try {
    const service = await Service.findById(
      req.params.id
    ).populate(
      "provider",
      "name isProviderVerified averageRating accountStatus"
    );

    if (
      !service ||
      !service.provider ||
      !service.provider.isProviderVerified ||
      service.provider.accountStatus === "Suspended"
    ) {
      return res.status(404).json({
        message: "Service not found",
      });
    }

    res.json(service);
  } catch (err) {
    next(err);
  }
}

// ============================================================
// GET MY SERVICES
// ============================================================

async function getMyServices(req, res, next) {
  try {
    const services = await Service.find({
      provider: req.user._id,
    }).sort("-createdAt");

    res.json(services);
  } catch (err) {
    next(err);
  }
}

// ============================================================
// CREATE SERVICE
// ============================================================

async function createService(req, res, next) {
  try {
    // 1. CHECK KYC
    const kyc = await Kyc.findOne({
      provider: req.user._id,
    });

    if (!kyc) {
      return res.status(403).json({
        message:
          "KYC verification is required before you can provide services.",
        kycStatus: "NotSubmitted",
      });
    }

    if (kyc.status === "Pending") {
      return res.status(403).json({
        message:
          "Your KYC is pending admin approval. You cannot add a service yet.",
        kycStatus: "Pending",
      });
    }

    if (kyc.status === "Rejected") {
      return res.status(403).json({
        message:
          "Your KYC was rejected. Please resubmit your KYC before adding a service.",
        kycStatus: "Rejected",
        rejectionReason: kyc.rejectionReason,
      });
    }

    if (kyc.status !== "Approved") {
      return res.status(403).json({
        message:
          "Your KYC is not approved. You cannot add a service.",
        kycStatus: kyc.status,
      });
    }

    // 2. CHECK PROVIDER
    const provider = await User.findById(
      req.user._id
    );

    if (!provider) {
      return res.status(404).json({
        message: "Provider not found",
      });
    }

    if (
      provider.accountStatus === "Suspended"
    ) {
      return res.status(403).json({
        message:
          "Your account is suspended. You cannot add services.",
      });
    }

    // SELF-HEAL: KYC is Approved, so the account flag MUST be true.
    // If an older admin-approval run left it false (data drift), repair it
    // here instead of blocking the provider forever.
    if (!provider.isProviderVerified) {
      provider.isProviderVerified = true;
      await provider.save();
    }

    // 3. SERVICE DATA
    const {
      category,
      description,
      price,
      availability,
      location,
    } = req.body;

    if (
      !category ||
      !description ||
      price == null
    ) {
      return res.status(400).json({
        message:
          "category, description and price are required",
      });
    }

    // 4. PARSE CITY / AREA
    const loc = parseLocation(location);

    if (!loc.ok) {
      return res.status(400).json({
        message: loc.message,
      });
    }

    // 5. PARSE OPTIONAL GPS
    const geo = parseGeoLocation(location);

    if (!geo.ok) {
      return res.status(400).json({
        message: geo.message,
      });
    }

    // 6. CREATE SERVICE
    const serviceData = {
      provider: req.user._id,
      category,
      description,
      price,
      availability:
        availability ?? true,
    };

    if (loc.value) {
      serviceData.location = loc.value;
    }

    if (geo.value) {
      serviceData.geoLocation = geo.value;
    }

    const service = await Service.create(
      serviceData
    );

    res.status(201).json({
      message:
        "Service listed successfully",
      serviceId: service._id,
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// UPDATE SERVICE
// ============================================================

async function updateService(req, res, next) {
  try {
    const service = await Service.findById(
      req.params.id
    );

    if (!service) {
      return res.status(404).json({
        message: "Service not found",
      });
    }

    if (
      service.provider.toString() !==
      req.user._id.toString()
    ) {
      return res.status(403).json({
        message:
          "You can only edit your own service listings",
      });
    }

    const {
      category,
      description,
      price,
      availability,
      location,
    } = req.body;

    if (category !== undefined) {
      service.category = category;
    }

    if (description !== undefined) {
      service.description = description;
    }

    if (price !== undefined) {
      service.price = price;
    }

    if (availability !== undefined) {
      service.availability =
        availability;
    }

    if (location !== undefined) {
      const loc = parseLocation(location);

      if (!loc.ok) {
        return res.status(400).json({
          message: loc.message,
        });
      }

      const geo =
        parseGeoLocation(location);

      if (!geo.ok) {
        return res.status(400).json({
          message: geo.message,
        });
      }

      service.location =
        loc.value || undefined;

      service.geoLocation =
        geo.value || undefined;
    }

    await service.save();

    res.json({
      message:
        "Service updated successfully",
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// DELETE SERVICE
// ============================================================

async function deleteService(req, res, next) {
  try {
    const service = await Service.findById(
      req.params.id
    );

    if (!service) {
      return res.status(404).json({
        message: "Service not found",
      });
    }

    if (
      service.provider.toString() !==
        req.user._id.toString() &&
      req.user.role !== "Admin"
    ) {
      return res.status(403).json({
        message:
          "You can only delete your own service listings",
      });
    }

    await service.deleteOne();

    res.json({
      message:
        "Service deleted successfully",
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllServices,
  getServiceById,
  getMyServices,
  createService,
  updateService,
  deleteService,
};