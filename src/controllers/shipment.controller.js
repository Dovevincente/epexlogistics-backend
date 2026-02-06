import mongoose from "mongoose";
import Shipment from "../models/Shipment.js";
import Tracking from "../models/Tracking.js";
import generateTracking from "../utils/generateTracking.js";
import { sendEmail } from "../utils/email.js";

/* ======================================================
   🌍 SIMPLE GEOCODING HELPER (OpenStreetMap)
====================================================== */
const geocodeLocation = async (city, country) => {
  try {
    const query = encodeURIComponent(`${city}, ${country}`);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Epex Logistics/1.0 (admin@epexlogistics.com)",
      },
    });

    const data = await res.json();

    if (Array.isArray(data) && data.length > 0) {
      return {
        lat: Number(data[0].lat),
        lng: Number(data[0].lon),
      };
    }

    return { lat: null, lng: null };
  } catch (err) {
    console.error("Geocoding failed:", err);
    return { lat: null, lng: null };
  }
};

/* ======================================================
   🔢 INVOICE NUMBER GENERATOR
====================================================== */
const generateInvoiceNumber = () => {
  return `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
};

/* ======================================================
   💰 VAT PERCENT RESOLVER (✅ ADDED – AUTO)
====================================================== */
const getVatPercentByCountry = (country) => {
  if (!country) return 0;

  const c = country.toLowerCase();

  if (c === "nigeria") return 7.5;
  if (c === "united kingdom" || c === "uk") return 20;
  if (c === "united states" || c === "usa") return 0;

  return 0;
};

/* ======================================================
   GET ALL SHIPMENTS (ADMIN)
====================================================== */
export const getShipments = async (req, res) => {
  try {
    const shipments = await Shipment.find()
      .populate("customer", "name email")
      .populate("quote")
      .sort({ createdAt: -1 });

    res.json(shipments);
  } catch (error) {
    console.error("Fetch shipments error:", error);
    res.status(500).json({ message: "Failed to fetch shipments" });
  }
};

/* ======================================================
   CREATE SHIPMENT (ADMIN / WALK-IN) ✅ FIXED
====================================================== */
export const createShipment = async (req, res) => {
  try {
    const {
      customer,
      quote,
      sender,
      receiver,
      origin,
      destination,
      weight,
      quantity,
      deliveryRange,
      price,
      city,
      country,
      adminNote,
      paymentMethod,
    } = req.body;

    /* ================= VALIDATION ================= */
    if (
      !sender?.name ||
      !sender?.phone ||
      !sender?.address ||
      !receiver?.name ||
      !receiver?.phone ||
      !receiver?.address ||
      !origin ||
      !destination ||
      !weight ||
      !deliveryRange ||
      price === undefined ||
      !city ||
      !country
    ) {
      return res.status(400).json({
        message: "Missing required shipment details",
      });
    }

    if (customer && !mongoose.Types.ObjectId.isValid(customer)) {
      return res.status(400).json({ message: "Invalid customer ID" });
    }

    if (quote && !mongoose.Types.ObjectId.isValid(quote)) {
      return res.status(400).json({ message: "Invalid quote ID" });
    }

    /* ================= DELIVERY DATE ================= */
    const today = new Date();
    const estimatedDelivery = new Date(today);

    const normalizedRange = deliveryRange
      .toLowerCase()
      .replace(/[–—]/g, "-")
      .trim();

    if (normalizedRange.startsWith("6-10")) {
      estimatedDelivery.setDate(today.getDate() + 8);
    } else if (normalizedRange.startsWith("1-3")) {
      estimatedDelivery.setDate(today.getDate() + 2);
    } else {
      return res.status(400).json({
        message: "Invalid delivery range. Use 1–3 or 6–10 business days",
      });
    }

    /* ================= INVOICE CALCULATION (✅ AUTO VAT) ================= */
    const subtotal = Number(price);
    const vatPercent = getVatPercentByCountry(country);
    const tax = (subtotal * vatPercent) / 100;
    const discount = 0;
    const total = subtotal + tax - discount;

    /* ================= CREATE SHIPMENT ================= */
    const trackingNumber = generateTracking();
    const invoiceNumber = generateInvoiceNumber();

    const shipment = await Shipment.create({
      trackingNumber,
      customer: customer || null,
      quote: quote || null,

      sender: {
        name: sender.name,
        email: sender.email || "",
        phone: sender.phone,
        address: sender.address,
      },

      receiver: {
        name: receiver.name,
        email: receiver.email || "",
        phone: receiver.phone,
        address: receiver.address,
      },

      origin,
      destination,
      city,
      country,

      weight: Number(weight),
      quantity: quantity ? Number(quantity) : 1,

      deliveryRange,
      estimatedDelivery,

      price: subtotal,

      invoice: {
        subtotal,
        vatPercent,
        tax,
        discount,
        total,
        currency: "$",
      },

      paymentMethod: paymentMethod || "Cash",

      invoiceStatus: "Paid",
      invoiceNumber,
      invoiceIssuedAt: new Date(),
      paidAt: new Date(),
      invoicePublic: true,
      invoiceWatermark: "PAID",

      adminNote: adminNote || "",

      status: "Booked",
      isDelivered: false,
    });

    /* ================= INITIAL TRACKING ================= */
    const { lat, lng } = await geocodeLocation(city, country);

    await Tracking.create({
      shipment: shipment._id,
      trackingNumber,
      status: "Booked",
      city,
      country,
      lat,
      lng,
      message: "Shipment booked. Thank you for choosing Epex Logistics",
    });

    /* ================= EMAIL SENDER ONLY ================= */
    if (shipment.sender.email) {
      try {
        await sendEmail({
          to: shipment.sender.email,
          subject: `Shipment Booked – ${trackingNumber}`,
          html: `
            <div style="font-family:Arial;line-height:1.6">
              <h2>📦 Shipment Successfully Booked</h2>

              <p>Hello ${shipment.sender.name},</p>

              <p>Your shipment has been created successfully.</p>

              <p><strong>Tracking Number:</strong> ${trackingNumber}</p>
              <p><strong>Route:</strong> ${origin} → ${destination}</p>
              <p><strong>Estimated Delivery:</strong> ${estimatedDelivery.toDateString()}</p>

              <hr/>

              <p>
                Track your shipment anytime:<br/>
                https://epexlogistics.com/track
              </p>

              <br/>
              <strong>Epex Logistics</strong><br/>
              support@epexlogistics.com
            </div>
          `,
        });
      } catch (emailErr) {
        console.error("Shipment creation email failed:", emailErr.message);
      }
    }

    res.status(201).json({
      message: "Shipment created successfully",
      shipment,
    });
  } catch (error) {
    console.error("🔥 Create shipment error:", error);
    res.status(500).json({
      message: error.message || "Failed to create shipment",
    });
  }
};

/* ======================================================
   🧾 PUBLIC SHIPMENT INVOICE (NO LOGIN)
====================================================== */
export const getPublicShipmentInvoice = async (req, res) => {
  try {
    const { trackingNumber } = req.params;

    const shipment = await Shipment.findOne({ trackingNumber });

    if (!shipment || shipment.invoicePublic !== true) {
      return res.status(404).json({
        message: "Invoice not found or not public",
      });
    }

    res.json({
      invoice: {
        invoiceNumber: shipment.invoiceNumber,
        issuedAt: shipment.invoiceIssuedAt,
        status: "PAID",
        watermark: shipment.invoiceWatermark,
      },

      shipment: {
        trackingNumber: shipment.trackingNumber,
        origin: shipment.origin,
        destination: shipment.destination,
        weight: shipment.weight,
        quantity: shipment.quantity,
        deliveryRange: shipment.deliveryRange,
        estimatedDelivery: shipment.estimatedDelivery,
        status: shipment.status,
      },

      sender: shipment.sender,
      receiver: shipment.receiver,

      payment: {
        method: shipment.paymentMethod,
        subtotal: shipment.invoice.subtotal,
        vatPercent: shipment.invoice.vatPercent,
        tax: shipment.invoice.tax,
        discount: shipment.invoice.discount,
        total: shipment.invoice.total,
        currency: shipment.invoice.currency,
        paidAt: shipment.paidAt,
      },
    });
  } catch (error) {
    console.error("Public invoice fetch error:", error);
    res.status(500).json({ message: "Failed to fetch invoice" });
  }
};

/* ======================================================
   🧾 GET SHIPMENT INVOICE (ADMIN)
====================================================== */
export const getShipmentInvoice = async (req, res) => {
  try {
    const shipment = await Shipment.findById(req.params.id);

    if (!shipment) {
      return res.status(404).json({ message: "Shipment not found" });
    }

    res.json({
      invoice: {
        invoiceNumber: shipment.invoiceNumber,
        issuedAt: shipment.invoiceIssuedAt,
        status: shipment.invoiceStatus,
      },
      shipment,
      payment: shipment.invoice,
    });
  } catch (error) {
    console.error("Invoice fetch error:", error);
    res.status(500).json({ message: "Failed to fetch invoice" });
  }
};

/* ======================================================
   UPDATE SHIPMENT STATUS (ADMIN)
====================================================== */
export const updateShipmentStatus = async (req, res) => {
  try {
    const { status, city, country, message, lat, lng } = req.body;

    if (!status || !city || !country) {
      return res.status(400).json({
        message: "Status, city and country are required",
      });
    }

    const allowedStatuses = [
      "In Transit",
      "Customs Clearance",
      "On Hold",
      "Out for Delivery",
      "Delivered",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid shipment status" });
    }

    const shipment = await Shipment.findById(req.params.id);
    if (!shipment) {
      return res.status(404).json({ message: "Shipment not found" });
    }

    if (shipment.isDelivered) {
      return res.status(400).json({
        message: "Shipment already delivered. Updates locked.",
      });
    }

    const coordinates =
      lat !== undefined && lng !== undefined
        ? { lat, lng }
        : await geocodeLocation(city, country);

    await Tracking.create({
      shipment: shipment._id,
      trackingNumber: shipment.trackingNumber,
      status,
      city,
      country,
      lat: coordinates.lat,
      lng: coordinates.lng,
      message: message || `${status} — ${city}, ${country}`,
    });

    shipment.status = status;

    if (status === "Delivered") {
      shipment.isDelivered = true;
      shipment.deliveredAt = new Date();
    }

    await shipment.save();

    /* ================= EMAIL BOTH SENDER & RECEIVER ================= */

    try {
      await sendEmail({
        to: [
          shipment.sender.email,
          shipment.receiver.email
        ],
        subject: `Shipment Update – ${shipment.trackingNumber}`,
        html: `
          <div style="font-family:Arial;line-height:1.6">
            <h2>📦 Shipment Status Updated</h2>

            <p><strong>Tracking Number:</strong> ${shipment.trackingNumber}</p>
            <p><strong>Status:</strong> ${status}</p>
            <p><strong>Location:</strong> ${city}, ${country}</p>
            <p>${message || status}</p>

            <hr/>

            <p>
              Track shipment anytime:<br/>
              https://epexlogistics.com/track
            </p>

            <br/>
            <strong>Epex Logistics</strong><br/>
            support@epexlogistics.com
          </div>
        `,
      });
    } catch (emailErr) {
      console.error("Shipment email failed:", emailErr.message);
    }

    res.json({
      message: "Shipment status updated successfully",
      shipment,
    });
  } catch (error) {
    console.error("Update shipment error:", error);
    res.status(500).json({ message: "Failed to update shipment" });
  }
};


/* ======================================================
   DELETE SHIPMENT (ADMIN)
====================================================== */
export const deleteShipment = async (req, res) => {
  try {
    const shipment = await Shipment.findById(req.params.id);

    if (!shipment) {
      return res.status(404).json({ message: "Shipment not found" });
    }

    await Tracking.deleteMany({ shipment: shipment._id });
    await shipment.deleteOne();

    res.json({ message: "Shipment deleted successfully" });
  } catch (error) {
    console.error("Delete shipment error:", error);
    res.status(500).json({ message: "Failed to delete shipment" });
  }
};
