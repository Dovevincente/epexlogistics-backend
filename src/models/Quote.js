import mongoose from "mongoose";

const quoteSchema = new mongoose.Schema(
  {
    /* ================= REGISTERED USER ================= */
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    /* ================= GUEST INFO ================= */
    guest: {
      name: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
    },

    /* ================= QUOTE REQUEST DETAILS ================= */
    pickup: {
      type: String,
      required: true,
      trim: true,
    },

    destination: {
      type: String,
      required: true,
      trim: true,
    },

    weight: {
      type: Number,
      required: true,
      min: 0.1,
    },

    /* ================= PRICING (ADMIN) ================= */
    price: {
      type: Number,
      default: null, // admin sets later
      min: 0,
    },

    deliveryRange: {
      type: String, // e.g. "6–10 business days"
      default: null,
      trim: true,
    },

    estimatedDelivery: {
      type: Date, // system-calculated after pricing
      default: null,
    },

    /* ================= QUOTE STATUS ================= */
    status: {
      type: String,
      enum: [
        "Pending",           // customer submitted quote
        "Priced",            // admin set price
        "Accepted",          // customer accepted price
        "Declined",          // customer declined
        "ReadyForShipment",  // customer submitted shipment details
        "Converted",         // admin created shipment
        "Rejected",          // admin rejected quote
      ],
      default: "Pending",
      index: true,
    },

    /* ================= ADMIN ACTIONS ================= */
    pricedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    pricedAt: {
      type: Date,
      default: null,
    },

    /* ================= CUSTOMER ACTION ================= */
    acceptedAt: {
      type: Date,
      default: null,
    },

    declinedAt: {
      type: Date,
      default: null,
    },

    /* ================= SHIPMENT DETAILS (CUSTOMER INPUT) ================= */
    shipmentDetails: {
      sender: {
        name: String,
        phone: String,
        email: String,
        address: String,
      },

      receiver: {
        name: String,
        phone: String,
        email: String,
        address: String,
      },

      city: String,
      country: String,

      quantity: {
        type: Number,
        min: 1,
        default: 1,
      },

      adminNote: {
        type: String,
        trim: true,
        default: "",
      },

      submittedAt: {
        type: Date,
        default: null,
      },
    },

    /* ================= SHIPMENT LINK ================= */
    shipment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shipment",
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Quote", quoteSchema);
