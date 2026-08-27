import mongoose from "mongoose";

const trackingSchema = new mongoose.Schema(
  {
    /* ======================================================
       LINKED SHIPMENT
    ====================================================== */
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

    /* ======================================================
       STATUS EVENT
    ====================================================== */
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

    /* ======================================================
       PROGRESS
    ====================================================== */
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    /* ======================================================
       LOCATION
    ====================================================== */
    city: {
      type: String,
      required: true,
      trim: true,
    },

    country: {
      type: String,
      required: true,
      trim: true,
    },

    lat: {
      type: Number,
      default: null,
    },

    lng: {
      type: Number,
      default: null,
    },

    /* ======================================================
       MESSAGE
    ====================================================== */
    message: {
      type: String,
      default: "",
      trim: true,
    },

    /* ======================================================
       SENDER SNAPSHOT
    ====================================================== */
    sender: {
      name: {
        type: String,
        default: "",
      },

      email: {
        type: String,
        default: "",
      },

      phone: {
        type: String,
        default: "",
      },

      address: {
        type: String,
        default: "",
      },
    },

    /* ======================================================
       RECEIVER SNAPSHOT
    ====================================================== */
    receiver: {
      name: {
        type: String,
        default: "",
      },

      email: {
        type: String,
        default: "",
      },

      phone: {
        type: String,
        default: "",
      },

      address: {
        type: String,
        default: "",
      },
    },

    /* ======================================================
       SHIPMENT SNAPSHOT
    ====================================================== */
    shipmentInfo: {
      origin: {
        type: String,
        default: "",
      },

      destination: {
        type: String,
        default: "",
      },

      weight: {
        type: Number,
        default: 0,
      },

      quantity: {
        type: Number,
        default: 1,
      },

      price: {
        type: Number,
        default: 0,
      },

      deliveryRange: {
        type: String,
        default: "",
      },

      estimatedDelivery: {
        type: Date,
        default: null,
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* ======================================================
   PREVENT DUPLICATE SYSTEM EVENTS
====================================================== */

trackingSchema.index(
  {
    shipment: 1,
    status: 1,
  },
  {
    unique: true,

    partialFilterExpression: {
      status: {
        $in: [
          "Booked",
          "Picked Up",
          "Delivered",
        ],
      },
    },
  }
);

/* ======================================================
   DELIVERY LOCK
====================================================== */

trackingSchema.pre(
  "save",
  async function (next) {
    try {
      /*
       * Delivered event itself is allowed.
       */
      if (this.status === "Delivered") {
        return next();
      }

      const Shipment =
        mongoose.model("Shipment");

      const shipment =
        await Shipment.findById(
          this.shipment
        );

      if (
        shipment?.isDelivered === true
      ) {
        return next(
          new Error(
            "Tracking is locked. Shipment already delivered."
          )
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  }
);

export default mongoose.model(
  "Tracking",
  trackingSchema
);