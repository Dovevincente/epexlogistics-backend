import mongoose from "mongoose";

/* =========================================================
   CUSTOMS STAGES
========================================================= */

export const CUSTOMS_STAGES = [
  "Prepared for Customs",
  "Checked by Customs",
  "Released by Customs",
  "Shipment Given to Our Agent",
];

/* =========================================================
   TRACKING SCHEMA
========================================================= */

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

       MAIN SHIPMENT STATUSES
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
       CUSTOMS STAGE

       Only used when status is:
       "Customs Clearance"

       Flow:

       Prepared for Customs
              ↓
       Checked by Customs
              ↓
       Released by Customs
              ↓
       Shipment Given to Our Agent
    ====================================================== */

    customsStage: {
      type: String,
      enum: CUSTOMS_STAGES,
      default: null,
      trim: true,
    },

    /* ======================================================
       CUSTOMS STAGE NUMBER

       0 = Prepared for Customs
       1 = Checked by Customs
       2 = Released by Customs
       3 = Shipment Given to Our Agent
    ====================================================== */

    customsStageIndex: {
      type: Number,
      min: 0,
      max: 3,
      default: null,
    },

    /* ======================================================
       PROGRESS

       0   = Booked
       100 = Delivered
    ====================================================== */

    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    /* ======================================================
       CURRENT LOCATION
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

    /* ======================================================
       CURRENT MAP COORDINATES
    ====================================================== */

    lat: {
      type: Number,
      default: null,
    },

    lng: {
      type: Number,
      default: null,
    },

    /* ======================================================
       ORIGIN COORDINATES

       Used for calculating the shipment's
       position along the route.
    ====================================================== */

    originLat: {
      type: Number,
      default: null,
    },

    originLng: {
      type: Number,
      default: null,
    },

    /* ======================================================
       DESTINATION COORDINATES
    ====================================================== */

    destinationLat: {
      type: Number,
      default: null,
    },

    destinationLng: {
      type: Number,
      default: null,
    },

    /* ======================================================
       DESTINATION INFORMATION
    ====================================================== */

    destinationCity: {
      type: String,
      default: "",
      trim: true,
    },

    destinationCountry: {
      type: String,
      default: "",
      trim: true,
    },

    /* ======================================================
       ROUTE DISTANCE
    ====================================================== */

    routeDistance: {
      type: Number,
      default: null,
      min: 0,
    },

    routeDistanceUnit: {
      type: String,
      enum: ["km", "mi"],
      default: "km",
      trim: true,
    },

    /* ======================================================
       ESTIMATED ARRIVAL
    ====================================================== */

    estimatedArrival: {
      type: Date,
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

       Keeps the sender information that existed
       when the tracking event was created.
    ====================================================== */

    sender: {
      name: {
        type: String,
        default: "",
        trim: true,
      },

      email: {
        type: String,
        default: "",
        lowercase: true,
        trim: true,
      },

      phone: {
        type: String,
        default: "",
        trim: true,
      },

      address: {
        type: String,
        default: "",
        trim: true,
      },
    },

    /* ======================================================
       RECEIVER SNAPSHOT
    ====================================================== */

    receiver: {
      name: {
        type: String,
        default: "",
        trim: true,
      },

      email: {
        type: String,
        default: "",
        lowercase: true,
        trim: true,
      },

      phone: {
        type: String,
        default: "",
        trim: true,
      },

      address: {
        type: String,
        default: "",
        trim: true,
      },
    },

    /* ======================================================
       SHIPMENT SNAPSHOT
    ====================================================== */

    shipmentInfo: {
      origin: {
        type: String,
        default: "",
        trim: true,
      },

      destination: {
        type: String,
        default: "",
        trim: true,
      },

      weight: {
        type: Number,
        default: 0,
        min: 0,
      },

      quantity: {
        type: Number,
        default: 1,
        min: 1,
      },

      price: {
        type: Number,
        default: 0,
        min: 0,
      },

      deliveryRange: {
        type: String,
        default: "",
        trim: true,
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

    toJSON: {
      virtuals: true,
    },

    toObject: {
      virtuals: true,
    },
  }
);

/* =========================================================
   NORMALIZE PROGRESS
========================================================= */

trackingSchema.pre(
  "validate",
  function (next) {
    let progress = Number(this.progress);

    if (Number.isNaN(progress)) {
      progress = 0;
    }

    progress = Math.max(
      0,
      Math.min(100, progress)
    );

    /*
     * Delivered must always be 100%.
     */

    if (this.status === "Delivered") {
      progress = 100;
    }

    this.progress = progress;

    next();
  }
);

/* =========================================================
   AUTOMATIC CUSTOMS STAGE INDEX
========================================================= */

trackingSchema.pre(
  "validate",
  function (next) {
    /*
     * Non-customs events cannot contain
     * a customs stage.
     */

    if (
      this.status !== "Customs Clearance"
    ) {
      this.customsStage = null;
      this.customsStageIndex = null;

      return next();
    }

    /*
     * Customs Clearance without a specific
     * stage is allowed.
     */

    if (!this.customsStage) {
      this.customsStageIndex = null;

      return next();
    }

    const stageIndex =
      CUSTOMS_STAGES.indexOf(
        this.customsStage
      );

    if (stageIndex === -1) {
      return next(
        new Error(
          "Invalid customs stage."
        )
      );
    }

    this.customsStageIndex =
      stageIndex;

    next();
  }
);

/* =========================================================
   ENSURE CUSTOMS STAGE INDEX MATCHES STAGE
========================================================= */

trackingSchema.pre(
  "validate",
  function (next) {
    if (
      this.customsStage &&
      this.customsStageIndex !== null
    ) {
      const expectedIndex =
        CUSTOMS_STAGES.indexOf(
          this.customsStage
        );

      if (
        expectedIndex !==
        this.customsStageIndex
      ) {
        return next(
          new Error(
            "Customs stage and customs stage index do not match."
          )
        );
      }
    }

    next();
  }
);

/* =========================================================
   PREVENT DUPLICATE SYSTEM EVENTS

   These protected statuses can occur only once
   for a shipment.

   Customs Clearance is intentionally excluded
   because multiple customs updates are allowed.
========================================================= */

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

/* =========================================================
   CUSTOMS EVENT INDEX
========================================================= */

trackingSchema.index({
  shipment: 1,
  status: 1,
  customsStageIndex: 1,
  createdAt: 1,
});

/* =========================================================
   TRACKING NUMBER + CREATED DATE INDEX
========================================================= */

trackingSchema.index({
  trackingNumber: 1,
  createdAt: -1,
});

/* =========================================================
   LOCATION INDEX

   Useful when retrieving events by coordinates.
========================================================= */

trackingSchema.index({
  lat: 1,
  lng: 1,
});

/* =========================================================
   DELIVERY LOCK
========================================================= */

trackingSchema.pre(
  "save",
  async function (next) {
    try {
      /*
       * The Delivered event itself is allowed.
       */

      if (
        this.status === "Delivered"
      ) {
        return next();
      }

      const Shipment =
        mongoose.model("Shipment");

      const shipment =
        await Shipment.findById(
          this.shipment
        );

      /*
       * Once the shipment has been delivered,
       * no additional tracking event can be created.
       */

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

/* =========================================================
   EXPORT MODEL
========================================================= */

const Tracking =
  mongoose.models.Tracking ||
  mongoose.model(
    "Tracking",
    trackingSchema
  );

export default Tracking;