import Shipment from "../models/Shipment.js";
import Tracking from "../models/Tracking.js";

/* ======================================================
   📊 NORMALIZE PROGRESS
   Ensures progress is always between 0 and 100.
====================================================== */
const normalizeProgress = (value, status) => {
  let progress = Number(value);

  if (Number.isNaN(progress)) {
    progress = 0;
  }

  progress = Math.max(0, Math.min(100, progress));

  /* Delivered must always be 100% */
  if (status === "Delivered") {
    progress = 100;
  }

  return progress;
};

/* ======================================================
   🎯 CALCULATE POSITION BETWEEN TWO POINTS

   Used when the admin supplies progress but doesn't
   manually supply the current coordinates.

   0%   = origin
   50%  = halfway
   100% = destination
====================================================== */
const calculatePosition = (
  originLat,
  originLng,
  destinationLat,
  destinationLng,
  progress
) => {
  if (
    originLat === null ||
    originLng === null ||
    destinationLat === null ||
    destinationLng === null
  ) {
    return {
      lat: null,
      lng: null,
    };
  }

  const percentage = progress / 100;

  const lat =
    originLat + (destinationLat - originLat) * percentage;

  const lng =
    originLng + (destinationLng - originLng) * percentage;

  return {
    lat,
    lng,
  };
};

/* ======================================================
   TRACK SHIPMENT
   PUBLIC + ADMIN

   Returns:
   - shipment information
   - current progress
   - current location
   - origin/destination coordinates
   - complete tracking history
====================================================== */
export const trackShipment = async (req, res) => {
  try {
    const { trackingNumber } = req.params;

    if (!trackingNumber) {
      return res.status(400).json({
        message: "Tracking number is required",
      });
    }

    /* ================= FIND SHIPMENT ================= */

    const shipment = await Shipment.findOne({ trackingNumber })
      .populate("customer", "name email");

    if (!shipment) {
      return res.status(404).json({
        message: "Shipment not found",
      });
    }

    /* ================= FETCH TRACKING HISTORY ================= */

    const history = await Tracking.find({ trackingNumber })
      .sort({ createdAt: 1 })
      .select(
        `
        status
        progress
        city
        country
        lat
        lng
        originLat
        originLng
        destinationLat
        destinationLng
        destinationCity
        destinationCountry
        routeDistance
        routeDistanceUnit
        estimatedArrival
        message
        createdAt
        `
      );

    /* ======================================================
       FIND CURRENT TRACKING EVENT
    ====================================================== */

    const latestTracking =
      history.length > 0
        ? history[history.length - 1]
        : null;

    /* ======================================================
       CURRENT PROGRESS

       Shipment model doesn't necessarily have progress,
       so the latest Tracking event is the source of truth.
    ====================================================== */

    let currentProgress = latestTracking?.progress ?? 0;

    if (shipment.isDelivered) {
      currentProgress = 100;
    }

    /* ======================================================
       CURRENT LOCATION
    ====================================================== */

    const currentLocation = latestTracking
      ? {
          city: latestTracking.city,
          country: latestTracking.country,
          lat: latestTracking.lat ?? null,
          lng: latestTracking.lng ?? null,
        }
      : {
          city: shipment.city || "",
          country: shipment.country || "",
          lat: null,
          lng: null,
        };

    /* ======================================================
       ORIGIN / DESTINATION COORDINATES
    ====================================================== */

    const originTracking = history.find(
      (h) =>
        h.originLat !== null &&
        h.originLng !== null
    );

    const destinationTracking = history.find(
      (h) =>
        h.destinationLat !== null &&
        h.destinationLng !== null
    );

    const originCoordinates = {
      lat: originTracking?.originLat ?? null,
      lng: originTracking?.originLng ?? null,
    };

    const destinationCoordinates = {
      lat:
        destinationTracking?.destinationLat ?? null,
      lng:
        destinationTracking?.destinationLng ?? null,
    };

    /* ======================================================
       RESPONSE
    ====================================================== */

    res.json({
      shipment: {
        trackingNumber: shipment.trackingNumber,

        /* ---------- CUSTOMER ---------- */

        customer: shipment.customer
          ? {
              name: shipment.customer.name,
              email: shipment.customer.email,
            }
          : null,

        /* ---------- SENDER ---------- */

        sender: {
          name: shipment.sender?.name || "",
          phone: shipment.sender?.phone || "",
          email: shipment.sender?.email || "",
          address: shipment.sender?.address || "",
        },

        /* ---------- RECEIVER ---------- */

        receiver: {
          name: shipment.receiver?.name || "",
          phone: shipment.receiver?.phone || "",
          email: shipment.receiver?.email || "",
          address: shipment.receiver?.address || "",
        },

        /* ---------- ROUTE ---------- */

        origin: shipment.origin,
        destination: shipment.destination,

        /* ---------- CARGO ---------- */

        weight: shipment.weight,
        quantity: shipment.quantity,

        /* ---------- DELIVERY ---------- */

        deliveryRange: shipment.deliveryRange,
        estimatedDelivery: shipment.estimatedDelivery,

        /* ---------- PAYMENT ---------- */

        price: shipment.price,

        /* ---------- STATUS ---------- */

        status: shipment.status,
        isDelivered: shipment.isDelivered,

        /* ==================================================
           📊 CURRENT PROGRESS
        ================================================== */

        progress: currentProgress,

        /* ==================================================
           📍 CURRENT LOCATION
        ================================================== */

        currentLocation,

        /* ==================================================
           🏁 ROUTE COORDINATES
        ================================================== */

        originCoordinates,

        destinationCoordinates,

        /* ---------- METADATA ---------- */

        createdAt: shipment.createdAt,
      },

      /* ====================================================
         TRACKING HISTORY
      ==================================================== */

      history: history.map((h) => ({
        status: h.status,

        /* 🔑 NEW */
        progress:
          h.status === "Delivered"
            ? 100
            : h.progress ?? 0,

        city: h.city,
        country: h.country,

        /* ---------- CURRENT COORDINATES ---------- */

        lat: h.lat ?? null,
        lng: h.lng ?? null,

        /* Backward compatibility */

        coordinates: {
          lat: h.lat ?? null,
          lng: h.lng ?? null,
        },

        /* ---------- ROUTE COORDINATES ---------- */

        originCoordinates: {
          lat: h.originLat ?? null,
          lng: h.originLng ?? null,
        },

        destinationCoordinates: {
          lat: h.destinationLat ?? null,
          lng: h.destinationLng ?? null,
        },

        /* ---------- DESTINATION ---------- */

        destinationCity:
          h.destinationCity || shipment.destination,

        destinationCountry:
          h.destinationCountry || "",

        /* ---------- DISTANCE ---------- */

        routeDistance:
          h.routeDistance ?? null,

        routeDistanceUnit:
          h.routeDistanceUnit || "km",

        /* ---------- ETA ---------- */

        estimatedArrival:
          h.estimatedArrival || null,

        /* ---------- LOCATION STRING ---------- */

        location: `${h.city}, ${h.country}`,

        /* ---------- MESSAGE ---------- */

        message:
          h.message ||
          `${h.status} at ${h.city}, ${h.country}`,

        createdAt: h.createdAt,
      })),
    });
  } catch (error) {
    console.error("Tracking error:", error);

    res.status(500).json({
      message: "Failed to track shipment",
    });
  }
};

/* ======================================================
   ADD TRACKING EVENT
   ADMIN ONLY

   Admin can provide:
   - status
   - progress
   - city
   - country
   - coordinates
   - message

   If coordinates aren't supplied, the controller can
   calculate a position between origin and destination.
====================================================== */
export const addTrackingEvent = async (req, res) => {
  try {
    const {
      trackingNumber,
      status,
      progress,
      city,
      country,
      lat,
      lng,
      message,
      estimatedArrival,
    } = req.body;

    /* ================= VALIDATION ================= */

    if (
      !trackingNumber ||
      !status ||
      !city ||
      !country
    ) {
      return res.status(400).json({
        message:
          "trackingNumber, status, city and country are required",
      });
    }

    /* ==================================================
       ALLOWED STATUSES
    ================================================== */

    const allowedStatuses = [
      "Booked",
      "Picked Up",
      "In Transit",
      "Customs Clearance",
      "On Hold",
      "Out for Delivery",
      "Delivered",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid shipment status",
      });
    }

    /* ================= FIND SHIPMENT ================= */

    const shipment = await Shipment.findOne({
      trackingNumber,
    });

    if (!shipment) {
      return res.status(404).json({
        message: "Shipment not found",
      });
    }

    /* ==================================================
       DELIVERY LOCK
    ================================================== */

    if (shipment.isDelivered) {
      return res.status(400).json({
        message:
          "Shipment already delivered. Tracking updates are locked.",
      });
    }

    /* ==================================================
       NORMALIZE PROGRESS
    ================================================== */

    const normalizedProgress = normalizeProgress(
      progress,
      status
    );

    /* ==================================================
       GEOCODE ORIGIN
    ==================================================

       We use the shipment's existing route information.

       Since the shipment model stores origin/destination
       as strings, existing tracking records are checked
       for route coordinates first.
    ================================================== */

    const existingTracking = await Tracking.find({
      trackingNumber,
    }).sort({ createdAt: 1 });

    const firstTracking =
      existingTracking.length > 0
        ? existingTracking[0]
        : null;

    let originLat =
      firstTracking?.originLat ?? null;

    let originLng =
      firstTracking?.originLng ?? null;

    let destinationLat =
      firstTracking?.destinationLat ?? null;

    let destinationLng =
      firstTracking?.destinationLng ?? null;

    /* ==================================================
       CURRENT COORDINATES
    ================================================== */

    let currentLat =
      lat !== undefined && lat !== null
        ? Number(lat)
        : null;

    let currentLng =
      lng !== undefined && lng !== null
        ? Number(lng)
        : null;

    /* ==================================================
       IF CURRENT COORDINATES ARE NOT PROVIDED
       AND ROUTE COORDINATES EXIST,
       CALCULATE LOCATION FROM PROGRESS.
    ================================================== */

    if (
      (currentLat === null || currentLng === null) &&
      originLat !== null &&
      originLng !== null &&
      destinationLat !== null &&
      destinationLng !== null
    ) {
      const calculatedPosition =
        calculatePosition(
          originLat,
          originLng,
          destinationLat,
          destinationLng,
          normalizedProgress
        );

      currentLat = calculatedPosition.lat;
      currentLng = calculatedPosition.lng;
    }

    /* ==================================================
       DELIVERED = DESTINATION
    ================================================== */

    if (
      status === "Delivered" &&
      destinationLat !== null &&
      destinationLng !== null
    ) {
      currentLat = destinationLat;
      currentLng = destinationLng;
    }

    /* ==================================================
       CREATE TRACKING EVENT
    ================================================== */

    const tracking = await Tracking.create({
      shipment: shipment._id,

      trackingNumber,

      status,

      progress: normalizedProgress,

      city,

      country,

      lat: currentLat,

      lng: currentLng,

      originLat,

      originLng,

      destinationLat,

      destinationLng,

      destinationCity: shipment.destination,

      destinationCountry: "",

      estimatedArrival:
        estimatedArrival || shipment.estimatedDelivery,

      message:
        message ||
        `${status} — ${city}, ${country}`,

      sender: {
        name: shipment.sender?.name || "",
        email: shipment.sender?.email || "",
        phone: shipment.sender?.phone || "",
        address: shipment.sender?.address || "",
      },

      receiver: {
        name: shipment.receiver?.name || "",
        email: shipment.receiver?.email || "",
        phone: shipment.receiver?.phone || "",
        address: shipment.receiver?.address || "",
      },

      shipmentInfo: {
        origin: shipment.origin,
        destination: shipment.destination,
        weight: shipment.weight,
        quantity: shipment.quantity,
        price: shipment.price,
        deliveryRange: shipment.deliveryRange,
        estimatedDelivery:
          shipment.estimatedDelivery,
      },
    });

    /* ==================================================
       UPDATE SHIPMENT STATUS
    ================================================== */

    shipment.status = status;

    /* ==================================================
       DELIVERY
    ================================================== */

    if (status === "Delivered") {
      shipment.isDelivered = true;
      shipment.deliveredAt = new Date();
    }

    await shipment.save();

    /* ==================================================
       RESPONSE
    ================================================== */

    res.status(201).json({
      message: "Tracking update added successfully",

      tracking: {
        id: tracking._id,

        trackingNumber:
          tracking.trackingNumber,

        status: tracking.status,

        progress: tracking.progress,

        city: tracking.city,

        country: tracking.country,

        lat: tracking.lat,

        lng: tracking.lng,

        originLat: tracking.originLat,

        originLng: tracking.originLng,

        destinationLat:
          tracking.destinationLat,

        destinationLng:
          tracking.destinationLng,

        estimatedArrival:
          tracking.estimatedArrival,

        message: tracking.message,

        createdAt: tracking.createdAt,
      },
    });
  } catch (error) {
    console.error(
      "Add tracking error:",
      error
    );

    if (error.code === 11000) {
      return res.status(400).json({
        message:
          "This tracking event conflicts with an existing protected status.",
      });
    }

    res.status(500).json({
      message:
        error.message ||
        "Failed to add tracking update",
    });
  }
};