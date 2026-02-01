import mongoose from "mongoose";

const shipmentSchema = new mongoose.Schema(
  {
    /* ================= TRACKING ================= */
    trackingNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    /* ================= LINKED CUSTOMER ================= */
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    /* ================= SOURCE QUOTE ================= */
    quote: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quote",
      default: null,
      index: true,
    },

    /* ================= SENDER ================= */
    sender: {
      name: { type: String, required: true, trim: true },
      email: { type: String, lowercase: true, trim: true },
      phone: { type: String, required: true, trim: true },
      address: { type: String, required: true, trim: true },
    },

    /* ================= RECEIVER ================= */
    receiver: {
      name: { type: String, required: true, trim: true },
      email: { type: String, lowercase: true, trim: true },
      phone: { type: String, required: true, trim: true },
      address: { type: String, required: true, trim: true },
    },

    /* ================= ROUTE ================= */
    origin: { type: String, required: true, trim: true },
    destination: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },

    /* ================= CARGO ================= */
    weight: { type: Number, required: true, min: 0.1 },
    quantity: { type: Number, default: 1, min: 1 },

    /* ================= DELIVERY ================= */
    deliveryRange: {
      type: String,
      required: true,
      trim: true,
    },

    estimatedDelivery: {
      type: Date,
      required: true,
    },

    /* ================= PRICE ================= */
    price: {
      type: Number,
      required: true,
      min: 0,
    },

    /* ================= INVOICE BREAKDOWN ================= */
    invoice: {
      subtotal: {
        type: Number,
        default: 0,
        min: 0,
      },

      /* ✅ ADDED — REQUIRED BY CONTROLLER */
      vatPercent: {
        type: Number,
        default: 0,
        min: 0,
      },

      tax: {
        type: Number,
        default: 0,
        min: 0,
      },
      discount: {
        type: Number,
        default: 0,
        min: 0,
      },
      total: {
        type: Number,
        default: 0,
        min: 0,
      },
      currency: {
        type: String,
        default: "$",
        trim: true,
      },
    },

    /* ================= PAYMENT & INVOICE ================= */
    paymentMethod: {
      type: String,
      enum: ["Cash", "Bank Transfer", "Card", "Wallet"],
      default: "Cash",
      trim: true,
    },

    invoiceStatus: {
      type: String,
      enum: ["Unpaid", "Paid", "Pending"],
      default: "Unpaid",
      index: true,
    },

    invoiceNumber: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
    },

    invoiceIssuedAt: {
      type: Date,
      default: null,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    /* ================= INVOICE DISPLAY ================= */
    invoicePublic: {
      type: Boolean,
      default: true,
    },

    invoiceWatermark: {
      type: String,
      default: "PAID",
      trim: true,
    },

    /* ================= ADMIN NOTE ================= */
    adminNote: {
      type: String,
      default: "",
      trim: true,
    },

    /* ================= STATUS ================= */
    status: {
      type: String,
      enum: [
        "Booked",
        "Picked Up",
        "In Transit",
        "Customs Clearance",
        "On Hold",
        "Out for Delivery",
        "Delivered",
      ],
      default: "Booked",
      index: true,
    },

    isDelivered: { type: Boolean, default: false },
    deliveredAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    versionKey: false,
  }
);

/* ================= VIRTUALS ================= */

// Public invoice URL
shipmentSchema.virtual("invoiceUrl").get(function () {
  return `/invoice/${this.trackingNumber}`;
});

// Paid check
shipmentSchema.virtual("isInvoicePaid").get(function () {
  return this.invoiceStatus === "Paid";
});

export default mongoose.model("Shipment", shipmentSchema);
