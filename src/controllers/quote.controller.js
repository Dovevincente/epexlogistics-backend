import mongoose from "mongoose";
import Quote from "../models/Quote.js";
import Shipment from "../models/Shipment.js";
import Tracking from "../models/Tracking.js";
import generateTracking from "../utils/generateTracking.js";
import jwt from "jsonwebtoken";


/* ======================================================
   🌍 GEOLOCATION HELPER (ADDED – REQUIRED FOR MAP PIN)
====================================================== */
const geocodeLocation = async (city, country) => {
  try {
    const query = encodeURIComponent(`${city}, ${country}`);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "EpexLogistics/1.0",
      },
    });

    const data = await res.json();

    if (data && data.length > 0) {
      return {
        lat: Number(data[0].lat),
        lng: Number(data[0].lon),
      };
    }

    return { lat: null, lng: null };
  } catch {
    return { lat: null, lng: null };
  }
};

/* ======================================================
   CREATE QUOTE (PUBLIC / CUSTOMER)
====================================================== */
export const createQuote = async (req, res) => {
  try {
    // ================= OPTIONAL AUTH (FOR LOGGED-IN USERS)
    let userFromToken = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userFromToken = decoded?.id || null;
      } catch (err) {
        // invalid token → treat as guest
      }
    }

    const { pickup, destination, weight, name, email } = req.body;

    if (!pickup || !destination || !weight) {
      return res.status(400).json({
        message: "Pickup, destination and weight are required",
      });
    }

    let customer = null;
    let guest = null;

    if (req.user || userFromToken) {
      customer = req.user?._id || userFromToken;
    } else {
      if (!name || !email) {
        return res.status(400).json({
          message: "Name and email are required for guest quotes",
        });
      }
      guest = { name, email };
    }

    const quote = await Quote.create({
      customer,
      guest,
      pickup,
      destination,
      weight,
      status: "Pending",
    });

    res.status(201).json({
      message: "Quote submitted successfully",
      quote,
    });
  } catch (error) {
    console.error("Create quote error:", error);
    res.status(500).json({ message: "Failed to submit quote" });
  }
};

/* ======================================================
   GET ALL QUOTES (ADMIN)
====================================================== */
export const getAllQuotes = async (req, res) => {
  try {
    const quotes = await Quote.find()
      .populate("customer", "name email")
      .populate("shipment")
      .sort({ createdAt: -1 });

    res.json(quotes);
  } catch {
    res.status(500).json({ message: "Failed to fetch quotes" });
  }
};

/* ======================================================
   PRICE QUOTE (ADMIN)
====================================================== */
export const priceQuote = async (req, res) => {
  try {
    const { price, deliveryRange } = req.body;

    if (!price || Number(price) <= 0) {
      return res.status(400).json({ message: "Invalid price" });
    }

    const quote = await Quote.findById(req.params.id);
    if (!quote) return res.status(404).json({ message: "Quote not found" });

    if (quote.status !== "Pending") {
      return res
        .status(400)
        .json({ message: "Only pending quotes can be priced" });
    }

    quote.price = Number(price);
    quote.deliveryRange = deliveryRange || "6–10 business days";
    quote.status = "Priced";
    quote.pricedBy = req.user._id;
    quote.pricedAt = new Date();

    await quote.save();

    res.json({ message: "Quote priced successfully", quote });
  } catch {
    res.status(500).json({ message: "Failed to price quote" });
  }
};

/* ======================================================
   ACCEPT QUOTE (CUSTOMER)
====================================================== */
export const acceptQuote = async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id);
    if (!quote) return res.status(404).json({ message: "Quote not found" });

    if (quote.status !== "Priced") {
      return res
        .status(400)
        .json({ message: "Only priced quotes can be accepted" });
    }

    quote.status = "Accepted";
    quote.acceptedAt = new Date();
    await quote.save();

    res.json({
      message: "Quote accepted. Please complete shipment details.",
      quote,
    });
  } catch {
    res.status(500).json({ message: "Failed to accept quote" });
  }
};

/* ======================================================
   DECLINE QUOTE (CUSTOMER)
====================================================== */
export const declineQuote = async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id);
    if (!quote) return res.status(404).json({ message: "Quote not found" });

    if (quote.status !== "Priced") {
      return res
        .status(400)
        .json({ message: "Only priced quotes can be declined" });
    }

    quote.status = "Declined";
    quote.declinedAt = new Date();
    await quote.save();

    res.json({ message: "Quote declined", quote });
  } catch {
    res.status(500).json({ message: "Failed to decline quote" });
  }
};

/* ======================================================
   REJECT QUOTE (ADMIN)
====================================================== */
export const rejectQuote = async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id);
    if (!quote) return res.status(404).json({ message: "Quote not found" });

    if (!["Pending", "Priced"].includes(quote.status)) {
      return res.status(400).json({
        message: "Only pending or priced quotes can be rejected",
      });
    }

    quote.status = "Rejected";
    await quote.save();

    res.json({ message: "Quote rejected by admin", quote });
  } catch {
    res.status(500).json({ message: "Failed to reject quote" });
  }
};

/* ======================================================
   SUBMIT SHIPMENT DETAILS (CUSTOMER)
====================================================== */
export const submitShipmentDetails = async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id);

    if (!quote || quote.status !== "Accepted") {
      return res.status(400).json({
        message: "Quote is not eligible for shipment details",
      });
    }

    quote.shipmentDetails = {
      ...req.body,
      submittedAt: new Date(),
    };

    quote.status = "ReadyForShipment";
    await quote.save();

    res.json({
      message: "Shipment details submitted successfully",
      quote,
    });
  } catch (error) {
    console.error("Submit shipment details error:", error);
    res.status(500).json({ message: "Failed to submit shipment details" });
  }
};

/* ======================================================
   CONVERT QUOTE → SHIPMENT (ADMIN ONLY)
====================================================== */
export const convertToShipment = async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id).populate("customer");

    if (!quote) return res.status(404).json({ message: "Quote not found" });

    if (quote.status !== "ReadyForShipment") {
      return res.status(400).json({
        message: "Shipment details not completed by customer",
      });
    }

    const details = quote.shipmentDetails;
    const trackingNumber = generateTracking();

    const today = new Date();
    let estimatedDelivery = new Date(today);

    if (quote.deliveryRange === "6–10 business days") {
      estimatedDelivery.setDate(today.getDate() + 8);
    } else if (quote.deliveryRange === "1–3 business days") {
      estimatedDelivery.setDate(today.getDate() + 2);
    }

    const shipment = await Shipment.create({
      trackingNumber,
      customer: quote.customer || null,
      quote: quote._id,

      sender: details.sender,
      receiver: details.receiver,

      origin: quote.pickup,
      destination: quote.destination,
      city: details.city,
      country: details.country,

      weight: quote.weight,
      quantity: details.quantity || 1,

      deliveryRange: quote.deliveryRange,
      estimatedDelivery,

      price: quote.price,
      adminNote: details.adminNote || "Converted from accepted quote",

      status: "Booked",
      isDelivered: false,
    });

    /* ✅ ADD GEO COORDINATES FOR MAP PIN */
    const { lat, lng } = await geocodeLocation(details.city, details.country);

    await Tracking.create({
      shipment: shipment._id,
      trackingNumber,
      status: "Booked",
      city: details.city,
      country: details.country,

      lat,
      lng,

      sender: shipment.sender,
      receiver: shipment.receiver,

      shipmentInfo: {
        origin: shipment.origin,
        destination: shipment.destination,
        weight: shipment.weight,
        quantity: shipment.quantity,
        price: shipment.price,
        deliveryRange: shipment.deliveryRange,
        estimatedDelivery: shipment.estimatedDelivery,
      },

      message: "Shipment created from accepted quote",
    });

    quote.status = "Converted";
    quote.shipment = shipment._id;
    await quote.save();

    res.json({
      message: "Shipment created successfully",
      shipment,
    });
  } catch (error) {
    console.error("Convert to shipment error:", error);
    res.status(500).json({ message: "Failed to convert quote to shipment" });
  }
};

/* ======================================================
   GET MY QUOTES (CUSTOMER)
====================================================== */
export const getMyQuotes = async (req, res) => {
  try {
    const quotes = await Quote.find({ customer: req.user._id })
      .populate("shipment")
      .sort({ createdAt: -1 });

    res.json(quotes);
  } catch {
    res.status(500).json({ message: "Failed to fetch your quotes" });
  }
};
