import mongoose from "mongoose";

const trackingSchema = new mongoose.Schema(
  {
    /* ================= LINKED SHIPMENT ================= */
    shipment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shipment",
      required: true,
      index: true,
    },

    trackingNumber: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    /* ================= STATUS EVENT ================= */
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
      required: true,
    },

    /* ================= LOCATION ================= */
    city: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },

    lat: { type: Number, default: null },
    lng: { type: Number, default: null },

    /* ================= MESSAGE ================= */
    message: {
      type: String,
      default: "",
      trim: true,
    },

    /* ================= SNAPSHOT: SENDER ================= */
    sender: {
      name: String,
      email: String,
      phone: String,
      address: String,
    },

    /* ================= SNAPSHOT: RECEIVER ================= */
    receiver: {
      name: String,
      email: String,
      phone: String,
      address: String,
    },

    /* ================= SNAPSHOT: SHIPMENT INFO ================= */
    shipmentInfo: {
      origin: String,
      destination: String,
      weight: Number,
      quantity: Number,
      price: Number,
      deliveryRange: String,
      estimatedDelivery: Date,
    },
  },
  {
    timestamps: true,
  }
);

/* ================= SAFETY ================= */
trackingSchema.index(
  { shipment: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["Booked", "Picked Up", "Delivered"] },
    },
  }
);

/* ======================================================
   🔒 FINAL DELIVERY LOCK (ADDITIVE, NO REMOVALS)
====================================================== */
trackingSchema.pre("save", async function (next) {
  if (this.status === "Delivered") return next();

  const Shipment = mongoose.model("Shipment");
  const shipment = await Shipment.findById(this.shipment);

  if (shipment?.isDelivered === true) {
    return next(
      new Error("Tracking is locked. Shipment already delivered.")
    );
  }

  next();
});

export default mongoose.model("Tracking", trackingSchema);
