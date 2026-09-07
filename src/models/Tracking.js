import mongoose from "mongoose";

/* =========================================================
   CUSTOMS STAGES

   These values MUST match:

   - controller/shipment.js
   - models/Shipment.js
   - admin/shipment.jsx
   - Track.jsx

   Customs progress is SEPARATE from shipment progress.

   Prepared for Customs      = 25%
   Checked by Customs        = 50%
   Released by Customs       = 75%
   Given to Our Agent        = 100%
========================================================= */

export const CUSTOMS_STAGES = [
  "Prepared for Customs",
  "Checked by Customs",
  "Released by Customs",
  "Given to Our Agent",
];

export const CUSTOMS_PROGRESS = {
  "Prepared for Customs": 25,
  "Checked by Customs": 50,
  "Released by Customs": 75,
  "Given to Our Agent": 100,
};

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
      uppercase: true,
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

       This is independent from overall shipment progress.
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
       3 = Given to Our Agent
    ====================================================== */

    customsStageIndex: {
      type: Number,
      min: 0,
      max: 3,
      default: null,
    },

    /* ======================================================
       OVERALL SHIPMENT PROGRESS

       This field ONLY represents the shipment journey.

       0   = Booked
       20  = Picked Up
       60  = In Transit / Customs Clearance / On Hold
       90  = Out for Delivery
       100 = Delivered

       IMPORTANT:

       Customs progress NEVER changes this field.

       Customs reaching 100% does NOT make the shipment
       100% complete.
    ====================================================== */

    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    /* ======================================================
       CUSTOMS PROGRESS

       Completely independent from shipment progress.

       0   = No customs process
       25  = Prepared for Customs
       50  = Checked by Customs
       75  = Released by Customs
       100 = Given to Our Agent
    ====================================================== */

    customsProgress: {
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
      min: -90,
      max: 90,
    },

    lng: {
      type: Number,
      default: null,
      min: -180,
      max: 180,
    },

    /* ======================================================
       ORIGIN COORDINATES
    ====================================================== */

    originLat: {
      type: Number,
      default: null,
      min: -90,
      max: 90,
    },

    originLng: {
      type: Number,
      default: null,
      min: -180,
      max: 180,
    },

    /* ======================================================
       DESTINATION COORDINATES
    ====================================================== */

    destinationLat: {
      type: Number,
      default: null,
      min: -90,
      max: 90,
    },

    destinationLng: {
      type: Number,
      default: null,
      min: -180,
      max: 180,
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
   NORMALIZE TRACKING NUMBER
========================================================= */

trackingSchema.pre(
  "validate",
  function (next) {
    if (this.trackingNumber) {
      this.trackingNumber = this.trackingNumber
        .trim()
        .toUpperCase();
    }

    next();
  }
);

/* =========================================================
   NORMALIZE OVERALL SHIPMENT PROGRESS
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
     * ONLY Delivered can have overall
     * shipment progress of 100%.
     */

    if (this.status === "Delivered") {
      progress = 100;
    } else if (progress >= 100) {
      progress = 99;
    }

    this.progress = progress;

    next();
  }
);

/* =========================================================
   NORMALIZE CUSTOMS PROGRESS
========================================================= */

trackingSchema.pre(
  "validate",
  function (next) {
    let customsProgress =
      Number(this.customsProgress);

    if (Number.isNaN(customsProgress)) {
      customsProgress = 0;
    }

    customsProgress = Math.max(
      0,
      Math.min(100, customsProgress)
    );

    /*
     * Customs progress is independent.
     */

    if (
      this.status !== "Customs Clearance" &&
      !this.customsStage
    ) {
      /*
       * Do not automatically erase customsProgress.
       *
       * A completed customs process can remain at
       * 100% after the shipment leaves customs.
       */
      this.customsProgress =
        customsProgress;

      return next();
    }

    this.customsProgress =
      customsProgress;

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

    if (this.status !== "Customs Clearance") {
      this.customsStage = null;
      this.customsStageIndex = null;

      /*
       * Keep customsProgress because customs
       * progress is independent of shipment status.
       */

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
   CUSTOMS PROGRESS VALIDATION
========================================================= */

trackingSchema.pre(
  "validate",
  function (next) {
    /*
     * If there is no customs stage, preserve
     * whatever customsProgress the controller supplied.
     */

    if (!this.customsStage) {
      return next();
    }

    const expectedProgress =
      CUSTOMS_PROGRESS[
        this.customsStage
      ];

    if (
      expectedProgress !== undefined
    ) {
      /*
       * IMPORTANT:

       * This updates customsProgress,
       * NOT overall shipment progress.
       */

      this.customsProgress =
        expectedProgress;
    }

    next();
  }
);

/* =========================================================
   PREVENT INVALID OVERALL PROGRESS

   Only Delivered can be 100%.
========================================================= */

trackingSchema.pre(
  "validate",
  function (next) {
    if (
      this.status !== "Delivered" &&
      this.progress >= 100
    ) {
      this.progress = 99;
    }

    if (
      this.status === "Delivered"
    ) {
      this.progress = 100;
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

   Example:

   Shipment
      ↓
   Customs Clearance — Airport A
      ↓
   In Transit
      ↓
   Customs Clearance — Airport B
      ↓
   In Transit
      ↓
   Out for Delivery
      ↓
   Delivered
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

      if (this.status === "Delivered") {
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