import mongoose from "mongoose";

/* =========================================================
   SHIPMENT STATUS
========================================================= */

const SHIPMENT_STATUSES = [
  "Booked",
  "Picked Up",
  "In Transit",
  "Customs Clearance",
  "On Hold",
  "Out for Delivery",
  "Delivered",
];

/* =========================================================
   CUSTOMS STAGES

   These correspond directly with Track.jsx:

   0 = Prepared for Customs
   1 = Checked by Customs
   2 = Released by Customs
   3 = Given to Our Agent
========================================================= */

const CUSTOMS_STAGES = [
  "Prepared",
  "Checked",
  "Released",
  "Agent",
];

/* =========================================================
   SHIPMENT SCHEMA
========================================================= */

const shipmentSchema = new mongoose.Schema(
  {
    /* ======================================================
       TRACKING
    ====================================================== */

    trackingNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      uppercase: true,
    },

    /* ======================================================
       LINKED CUSTOMER
    ====================================================== */

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    /* ======================================================
       SOURCE QUOTE
    ====================================================== */

    quote: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quote",
      default: null,
      index: true,
    },

    /* ======================================================
       SENDER
    ====================================================== */

    sender: {
      name: {
        type: String,
        required: true,
        trim: true,
      },

      email: {
        type: String,
        lowercase: true,
        trim: true,
        default: "",
      },

      phone: {
        type: String,
        required: true,
        trim: true,
      },

      address: {
        type: String,
        required: true,
        trim: true,
      },
    },

    /* ======================================================
       RECEIVER
    ====================================================== */

    receiver: {
      name: {
        type: String,
        required: true,
        trim: true,
      },

      email: {
        type: String,
        lowercase: true,
        trim: true,
        default: "",
      },

      phone: {
        type: String,
        required: true,
        trim: true,
      },

      address: {
        type: String,
        required: true,
        trim: true,
      },
    },

    /* ======================================================
       ROUTE
    ====================================================== */

    origin: {
      type: String,
      required: true,
      trim: true,
    },

    destination: {
      type: String,
      required: true,
      trim: true,
    },

    /* ======================================================
       CURRENT LOCATION
       
       Kept for compatibility with Track.jsx.

       Track.jsx supports:

       shipment.currentLocation.city
       shipment.currentLocation.country
       shipment.currentLocation.lat
       shipment.currentLocation.lng

       It also supports the older:

       shipment.city
       shipment.country
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

    currentLocation: {
      city: {
        type: String,
        default: "",
        trim: true,
      },

      country: {
        type: String,
        default: "",
        trim: true,
      },

      lat: {
        type: Number,
        default: null,
        min: -90,
        max: 90,
      },

      lng: {
        type: Number,
        default: null,
        min: -180,
        max: 180,
      },

      updatedAt: {
        type: Date,
        default: null,
      },
    },

    /* ======================================================
       CARGO
    ====================================================== */

    weight: {
      type: Number,
      required: true,
      min: 0.1,
    },

    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },

    /* ======================================================
       DELIVERY
    ====================================================== */

    deliveryRange: {
      type: String,
      required: true,
      trim: true,
    },

    estimatedDelivery: {
      type: Date,
      required: true,
    },

    /* ======================================================
       PRICE
    ====================================================== */

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    /* ======================================================
       INVOICE
    ====================================================== */

    invoice: {
      subtotal: {
        type: Number,
        default: 0,
        min: 0,
      },

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

    /* ======================================================
       PAYMENT
    ====================================================== */

    paymentMethod: {
      type: String,
      enum: [
        "Cash",
        "Bank Transfer",
        "Card",
        "Wallet",
      ],
      default: "Cash",
      trim: true,
    },

    invoiceStatus: {
      type: String,
      enum: [
        "Unpaid",
        "Paid",
        "Pending",
      ],
      default: "Unpaid",
      index: true,
    },

    invoiceNumber: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
      trim: true,
    },

    invoiceIssuedAt: {
      type: Date,
      default: null,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    /* ======================================================
       PUBLIC INVOICE
    ====================================================== */

    invoicePublic: {
      type: Boolean,
      default: true,
    },

    invoiceWatermark: {
      type: String,
      default: "PAID",
      trim: true,
    },

    /* ======================================================
       ADMIN NOTE
    ====================================================== */

    adminNote: {
      type: String,
      default: "",
      trim: true,
    },

    /* ======================================================
       SHIPMENT STATUS
    ====================================================== */

    status: {
      type: String,
      enum: SHIPMENT_STATUSES,
      default: "Booked",
      index: true,
    },

    /* ======================================================
       PROGRESS

       0   = Booked
       100 = Delivered

       Track.jsx displays this directly.
    ====================================================== */

    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    /* ======================================================
       CUSTOMS CLEARANCE

       Used by Track.jsx:

       shipment.customsStage
       shipment.customs.stage

       We keep customsStage directly on the shipment
       because it makes admin updates and tracking simple.
    ====================================================== */

    customsStage: {
      type: String,
      enum: CUSTOMS_STAGES,
      default: null,
    },

    customs: {
      stage: {
        type: String,
        enum: CUSTOMS_STAGES,
        default: null,
      },

      startedAt: {
        type: Date,
        default: null,
      },

      checkedAt: {
        type: Date,
        default: null,
      },

      releasedAt: {
        type: Date,
        default: null,
      },

      agentReceivedAt: {
        type: Date,
        default: null,
      },

      note: {
        type: String,
        default: "",
        trim: true,
      },
    },

    /* ======================================================
       DELIVERY LOCK
       
       Once delivered:

       isDelivered = true
       deliveredAt = delivery date

       The tracking system should then prevent ordinary
       tracking events from being added.
    ====================================================== */

    isDelivered: {
      type: Boolean,
      default: false,
      index: true,
    },

    deliveredAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,

    toJSON: {
      virtuals: true,
    },

    toObject: {
      virtuals: true,
    },

    versionKey: false,
  }
);

/* =========================================================
   INDEXES
========================================================= */

shipmentSchema.index({
  trackingNumber: 1,
});

shipmentSchema.index({
  status: 1,
});

shipmentSchema.index({
  customer: 1,
});

shipmentSchema.index({
  invoiceStatus: 1,
});

shipmentSchema.index({
  isDelivered: 1,
});

/* =========================================================
   PUBLIC INVOICE URL
========================================================= */

shipmentSchema.virtual("invoiceUrl").get(function () {
  return `/invoice/${this.trackingNumber}`;
});

/* =========================================================
   INVOICE PAID CHECK
========================================================= */

shipmentSchema.virtual("isInvoicePaid").get(function () {
  return this.invoiceStatus === "Paid";
});

/* =========================================================
   CURRENT LOCATION VIRTUAL
       
   This gives us a safe fallback when older shipments
   only have city/country populated.
========================================================= */

shipmentSchema.virtual("currentCity").get(function () {
  return (
    this.currentLocation?.city ||
    this.city ||
    ""
  );
});

shipmentSchema.virtual("currentCountry").get(function () {
  return (
    this.currentLocation?.country ||
    this.country ||
    ""
  );
});

/* =========================================================
   CURRENT COORDINATES VIRTUAL
========================================================= */

shipmentSchema.virtual("coordinates").get(function () {
  const lat = this.currentLocation?.lat;
  const lng = this.currentLocation?.lng;

  if (
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lng))
  ) {
    return {
      lat: Number(lat),
      lng: Number(lng),
    };
  }

  return null;
});

/* =========================================================
   NORMALIZE TRACKING NUMBER
========================================================= */

shipmentSchema.pre("validate", function (next) {
  if (this.trackingNumber) {
    this.trackingNumber =
      this.trackingNumber
        .trim()
        .toUpperCase();
  }

  next();
});

/* =========================================================
   DELIVERY STATE SYNCHRONIZATION
       
   When shipment becomes Delivered:

   status       -> Delivered
   progress     -> 100
   isDelivered  -> true
   deliveredAt  -> current date
========================================================= */

shipmentSchema.pre(
  "save",
  function (next) {
    if (
      this.status === "Delivered"
    ) {
      this.progress = 100;

      if (!this.isDelivered) {
        this.isDelivered = true;
      }

      if (!this.deliveredAt) {
        this.deliveredAt = new Date();
      }
    }

    /*
     * If an administrator manually marks the shipment
     * as delivered, make sure the status also agrees.
     */
    if (
      this.isDelivered === true &&
      this.status !== "Delivered"
    ) {
      this.status = "Delivered";
      this.progress = 100;

      if (!this.deliveredAt) {
        this.deliveredAt = new Date();
      }
    }

    next();
  }
);

/* =========================================================
   PREVENT INVALID DELIVERED STATE
========================================================= */

shipmentSchema.pre(
  "save",
  function (next) {
    if (
      this.progress === 100 &&
      this.status !== "Delivered"
    ) {
      return next(
        new Error(
          "A shipment cannot have 100% progress unless it is Delivered."
        )
      );
    }

    if (
      this.status === "Delivered" &&
      this.progress !== 100
    ) {
      this.progress = 100;
    }

    next();
  }
);

/* =========================================================
   CUSTOMS STATE SYNCHRONIZATION
       
   Keep:

   customsStage

   and:

   customs.stage

   synchronized.
========================================================= */

shipmentSchema.pre(
  "save",
  function (next) {
    if (
      this.customsStage &&
      !this.customs?.stage
    ) {
      this.customs.stage =
        this.customsStage;
    }

    if (
      this.customs?.stage &&
      !this.customsStage
    ) {
      this.customsStage =
        this.customs.stage;
    }

    /*
     * If both exist but differ, the direct
     * customsStage field is treated as the
     * primary value.
     */
    if (
      this.customsStage &&
      this.customs?.stage &&
      this.customsStage !==
        this.customs.stage
    ) {
      this.customs.stage =
        this.customsStage;
    }

    next();
  }
);

/* =========================================================
   CUSTOMS DATE SYNCHRONIZATION
========================================================= */

shipmentSchema.pre(
  "save",
  function (next) {
    const now = new Date();

    if (
      this.customsStage === "Prepared" &&
      !this.customs?.startedAt
    ) {
      this.customs.startedAt = now;
    }

    if (
      this.customsStage === "Checked" &&
      !this.customs?.checkedAt
    ) {
      this.customs.checkedAt = now;
    }

    if (
      this.customsStage === "Released" &&
      !this.customs?.releasedAt
    ) {
      this.customs.releasedAt = now;
    }

    if (
      this.customsStage === "Agent" &&
      !this.customs?.agentReceivedAt
    ) {
      this.customs.agentReceivedAt = now;
    }

    next();
  }
);

/* =========================================================
   EXPORT
========================================================= */

export default mongoose.model(
  "Shipment",
  shipmentSchema
);