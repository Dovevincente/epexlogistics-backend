import Shipment from "../models/Shipment.js";
import Tracking from "../models/Tracking.js";

/* ======================================================
   TRACK SHIPMENT (PUBLIC + ADMIN)
   Returns shipment details + full tracking history
   🌍 Map-ready (lat/lng included)
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
      .select("status city country lat lng message createdAt");

    /* ================= RESPONSE ================= */
    res.json({
      shipment: {
        trackingNumber: shipment.trackingNumber,

        /* ---------- CUSTOMER (OPTIONAL) ---------- */
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
          email: shipment.sender?.email || "", // ✅ ADDED
          address: shipment.sender?.address || "",
        },

        /* ---------- RECEIVER ---------- */
        receiver: {
          name: shipment.receiver?.name || "",
          phone: shipment.receiver?.phone || "",
          email: shipment.receiver?.email || "", // ✅ ADDED
          address: shipment.receiver?.address || "",
        },

        /* ---------- ROUTE ---------- */
        origin: shipment.origin,
        destination: shipment.destination,

        /* ---------- CARGO ---------- */
        weight: shipment.weight,
        quantity: shipment.quantity,

        /* ---------- DELIVERY ---------- */
        estimatedDelivery: shipment.estimatedDelivery,

        /* ---------- PAYMENT ---------- */
        price: shipment.price,

        /* ---------- STATUS ---------- */
        status: shipment.status,
        isDelivered: shipment.isDelivered,

        /* ---------- METADATA ---------- */
        createdAt: shipment.createdAt,
      },

      /* ================= TRACKING HISTORY ================= */
      history: history.map((h) => ({
        status: h.status,
        city: h.city,
        country: h.country,

        /* 🔑 IMPORTANT: flat lat/lng for map animation */
        lat: h.lat ?? null,
        lng: h.lng ?? null,

        /* (kept for backward compatibility) */
        coordinates: {
          lat: h.lat ?? null,
          lng: h.lng ?? null,
        },

        location: `${h.city}, ${h.country}`,

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
   ADD TRACKING EVENT (ADMIN ONLY)
   ✔ Repeatable statuses allowed
   ❌ Booked / Picked Up / Delivered blocked
====================================================== */
export const addTrackingEvent = async (req, res) => {
  try {
    const { trackingNumber } = req.params;
    const { status, city, country, lat, lng, message } = req.body;

    if (!trackingNumber || !status || !city || !country) {
      return res.status(400).json({
        message: "trackingNumber, status, city and country are required",
      });
    }

    /* ================= BLOCK SYSTEM-ONLY STATUSES ================= */
    const blockedStatuses = ["Booked", "Picked Up", "Delivered"];

    if (blockedStatuses.includes(status)) {
      return res.status(400).json({
        message: `"${status}" is system-controlled and cannot be added manually`,
      });
    }

    /* ================= FIND SHIPMENT ================= */
    const shipment = await Shipment.findOne({ trackingNumber });

    if (!shipment) {
      return res.status(404).json({
        message: "Shipment not found",
      });
    }

    /* ================= CREATE TRACKING EVENT ================= */
    const tracking = await Tracking.create({
      shipment: shipment._id,
      trackingNumber,
      status,
      city,
      country,
      lat: lat ?? null,
      lng: lng ?? null,
      message: message || "",
    });

    /* ================= OPTIONAL SHIPMENT STATUS UPDATE ================= */
    shipment.status = status;
    if (status === "Delivered") {
      shipment.isDelivered = true;
      shipment.deliveredAt = new Date();
    }
    await shipment.save();

    res.status(201).json({
      message: "Tracking update added successfully",
      tracking,
    });
  } catch (error) {
    console.error("Add tracking error:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        message: "This status has already been recorded for this shipment",
      });
    }

    res.status(500).json({
      message: "Failed to add tracking update",
    });
  }
};
