import mongoose from "mongoose";

/* =========================================================
   SHIPMENT STATUS
========================================================= */

export const SHIPMENT_STATUSES = [
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

   IMPORTANT:
   These are COMPLETELY SEPARATE from shipment.progress.

   Prepared for Customs = 25%
   Checked by Customs   = 50%
   Released by Customs  = 75%
   Given to Our Agent   = 100%
========================================================= */

export const CUSTOMS_STAGES = [
  "Prepared for Customs",
  "Checked by Customs",
  "Released by Customs",
  "Given to Our Agent",
];

/* =========================================================
   CUSTOMS PROGRESS
========================================================= */

export const CUSTOMS_PROGRESS = {
  "Prepared for Customs": 25,
  "Checked by Customs": 50,
  "Released by Customs": 75,
  "Given to Our Agent": 100,
};

/* =========================================================
   CUSTOMS STATUSES
========================================================= */

export const CUSTOMS_STATUSES = [
  "In Progress",
  "Completed",
  "On Hold",
];

/* =========================================================
   OVERALL SHIPMENT PROGRESS

   IMPORTANT:

   This is ONLY for the overall shipment journey.

   Customs progress NEVER changes this value.
========================================================= */

export const SHIPMENT_PROGRESS = {
  Booked: 0,
  "Picked Up": 20,
  "In Transit": 60,
  "Customs Clearance": 60,
  "On Hold": 60,
  "Out for Delivery": 90,
  Delivered: 100,
};

/* =========================================================
   CUSTOMS CLEARANCE SUB-SCHEMA

   Every customs operation gets its own record.

   Example:

   customsClearances: [
     {
       airport: "Adolfo Suárez Madrid–Barajas Airport",
       airportCode: "MAD",
       progress: 100
     },
     {
       airport: "Zayed International Airport",
       airportCode: "AUH",
       progress: 50
     }
   ]

   The records NEVER overwrite each other.
========================================================= */

const customsClearanceSchema =
  new mongoose.Schema(
    {
      /* ================================================
         AIRPORT
      ================================================ */

      airport: {
        type: String,
        default: "",
        trim: true,
      },

      airportCode: {
        type: String,
        default: "",
        trim: true,
        uppercase: true,
      },

      terminal: {
        type: String,
        default: "",
        trim: true,
      },

      /* ================================================
         LOCATION
      ================================================ */

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

      /* ================================================
         CUSTOMS STATUS
      ================================================ */

      status: {
        type: String,
        enum: CUSTOMS_STATUSES,
        default: "In Progress",
      },

      /* ================================================
         CUSTOMS STAGE
      ================================================ */

      stage: {
        type: String,
        enum: CUSTOMS_STAGES,
        default: "Prepared for Customs",
      },

      /* ================================================
         CUSTOMS PROGRESS

         This is NOT shipment.progress.

         25 = Prepared
         50 = Checked
         75 = Released
         100 = Given to Agent
      ================================================ */

      progress: {
        type: Number,
        default: 25,
        min: 0,
        max: 100,
      },

      /* ================================================
         CUSTOMS TIMESTAMPS
      ================================================ */

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

      completedAt: {
        type: Date,
        default: null,
      },

      /* ================================================
         CUSTOMS NOTES
      ================================================ */

      notes: {
        type: String,
        default: "",
        trim: true,
      },
    },
    {
      _id: true,
      timestamps: true,
    }
  );

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
       OVERALL SHIPMENT PROGRESS

       THIS IS ONLY THE OVERALL JOURNEY.

       Booked           = 0%
       Picked Up        = 20%
       In Transit       = 60%
       Customs Clearance= 60%
       On Hold          = 60%
       Out for Delivery = 90%
       Delivered        = 100%

       IMPORTANT:

       Customs progress is NEVER stored here.
    ====================================================== */

    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    /* ======================================================
       CURRENT CUSTOMS SUMMARY

       These fields provide a convenient summary for
       the frontend.

       Complete customs history is stored inside:

       customsClearances[]
    ====================================================== */

    customsStage: {
      type: String,
      enum: CUSTOMS_STAGES,
      default: null,
      trim: true,
    },

    customs: {
      /* ================================================
         CURRENT CUSTOMS STAGE
      ================================================ */

      stage: {
        type: String,
        enum: CUSTOMS_STAGES,
        default: null,
        trim: true,
      },

      /* ================================================
         CURRENT CUSTOMS PROGRESS

         IMPORTANT:

         This is NOT shipment.progress.
      ================================================ */

      progress: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },

      /* ================================================
         CURRENT CUSTOMS TIMESTAMPS
      ================================================ */

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

      /* ================================================
         CURRENT CUSTOMS NOTE
      ================================================ */

      note: {
        type: String,
        default: "",
        trim: true,
      },
    },

    /* ======================================================
       CUSTOMS CLEARANCE HISTORY

       EVERY CUSTOMS LOCATION GETS ITS OWN RECORD.

       Example:

       Madrid
       ├── Prepared
       ├── Checked
       ├── Released
       └── Given to Agent = 100%

       Abu Dhabi
       ├── Prepared
       ├── Checked
       └── Released = 75%

       Istanbul
       └── Prepared = 25%

       NOTHING IS OVERWRITTEN.
    ====================================================== */

    customsClearances: {
      type: [customsClearanceSchema],
      default: [],
    },

    /* ======================================================
       DELIVERY LOCK

       ONLY ACTUAL DELIVERY LOCKS THE SHIPMENT.

       Customs reaching 100% does NOT lock the shipment.
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

shipmentSchema.index({
  "customsClearances.status": 1,
});

shipmentSchema.index({
  "customsClearances.airportCode": 1,
});

shipmentSchema.index({
  "customsClearances.city": 1,
  "customsClearances.country": 1,
});

/* =========================================================
   PUBLIC INVOICE URL
========================================================= */

shipmentSchema.virtual(
  "invoiceUrl"
).get(function () {
  return `/invoice/${this.trackingNumber}`;
});

/* =========================================================
   INVOICE PAID CHECK
========================================================= */

shipmentSchema.virtual(
  "isInvoicePaid"
).get(function () {
  return (
    this.invoiceStatus ===
    "Paid"
  );
});

/* =========================================================
   CURRENT LOCATION VIRTUAL
========================================================= */

shipmentSchema.virtual(
  "currentCity"
).get(function () {
  return (
    this.currentLocation?.city ||
    this.city ||
    ""
  );
});

shipmentSchema.virtual(
  "currentCountry"
).get(function () {
  return (
    this.currentLocation?.country ||
    this.country ||
    ""
  );
});

/* =========================================================
   CURRENT COORDINATES VIRTUAL
========================================================= */

shipmentSchema.virtual(
  "coordinates"
).get(function () {
  const lat =
    this.currentLocation?.lat;

  const lng =
    this.currentLocation?.lng;

  if (
    Number.isFinite(
      Number(lat)
    ) &&
    Number.isFinite(
      Number(lng)
    )
  ) {
    return {
      lat: Number(lat),
      lng: Number(lng),
    };
  }

  return null;
});

/* =========================================================
   LATEST CUSTOMS CLEARANCE VIRTUAL
========================================================= */

shipmentSchema.virtual(
  "latestCustomsClearance"
).get(function () {
  if (
    !Array.isArray(
      this.customsClearances
    ) ||
    this.customsClearances.length === 0
  ) {
    return null;
  }

  return (
    this.customsClearances[
      this.customsClearances.length - 1
    ]
  );
});

/* =========================================================
   ACTIVE CUSTOMS CLEARANCE VIRTUAL
========================================================= */

shipmentSchema.virtual(
  "activeCustomsClearance"
).get(function () {
  if (
    !Array.isArray(
      this.customsClearances
    )
  ) {
    return null;
  }

  for (
    let i =
      this.customsClearances.length - 1;
    i >= 0;
    i--
  ) {
    const clearance =
      this.customsClearances[i];

    if (
      clearance.status ===
        "In Progress" ||
      clearance.status ===
        "On Hold"
    ) {
      return clearance;
    }
  }

  return null;
});

/* =========================================================
   COMPLETED CUSTOMS CLEARANCES VIRTUAL
========================================================= */

shipmentSchema.virtual(
  "completedCustomsClearances"
).get(function () {
  if (
    !Array.isArray(
      this.customsClearances
    )
  ) {
    return [];
  }

  return this.customsClearances.filter(
    (clearance) =>
      clearance.status ===
        "Completed" ||
      clearance.progress === 100
  );
});

/* =========================================================
   NORMALIZE TRACKING NUMBER
========================================================= */

shipmentSchema.pre(
  "validate",
  function (next) {
    if (this.trackingNumber) {
      this.trackingNumber =
        this.trackingNumber
          .trim()
          .toUpperCase();
    }

    next();
  }
);

/* =========================================================
   NORMALIZE OVERALL SHIPMENT PROGRESS
========================================================= */

shipmentSchema.pre(
  "validate",
  function (next) {
    /*
     * The status is the source of truth
     * for the overall shipment progress.
     */

    const expectedProgress =
      SHIPMENT_PROGRESS[
        this.status
      ];

    if (
      expectedProgress !== undefined
    ) {
      this.progress =
        expectedProgress;
    }

    /*
     * Only Delivered may ever be 100%.
     */

    if (
      this.status !== "Delivered" &&
      this.progress >= 100
    ) {
      this.progress = 99;
    }

    next();
  }
);

/* =========================================================
   NORMALIZE CUSTOMS CLEARANCE RECORDS
========================================================= */

shipmentSchema.pre(
  "validate",
  function (next) {
    if (
      !Array.isArray(
        this.customsClearances
      )
    ) {
      this.customsClearances = [];
    }

    const now = new Date();

    this.customsClearances.forEach(
      (clearance) => {
        /* ==============================================
           AIRPORT CODE
        ============================================== */

        if (
          clearance.airportCode
        ) {
          clearance.airportCode =
            String(
              clearance.airportCode
            )
              .trim()
              .toUpperCase();
        }

        /* ==============================================
           NORMALIZE PROGRESS
        ============================================== */

        let progress =
          Number(
            clearance.progress
          );

        if (
          Number.isNaN(progress)
        ) {
          progress = 25;
        }

        clearance.progress =
          Math.max(
            0,
            Math.min(
              100,
              Math.round(progress)
            )
          );

        /* ==============================================
           STAGE → PROGRESS
        ============================================== */

        if (
          clearance.stage &&
          CUSTOMS_PROGRESS[
            clearance.stage
          ] !== undefined
        ) {
          clearance.progress =
            CUSTOMS_PROGRESS[
              clearance.stage
            ];
        }

        /* ==============================================
           ALWAYS HAVE START TIME
        ============================================== */

        if (
          !clearance.startedAt
        ) {
          clearance.startedAt =
            now;
        }

        /* ==============================================
           CHECKED STAGE
        ============================================== */

        if (
          clearance.stage ===
            "Checked by Customs" ||
          clearance.stage ===
            "Released by Customs" ||
          clearance.stage ===
            "Given to Our Agent"
        ) {
          if (
            !clearance.checkedAt
          ) {
            clearance.checkedAt =
              now;
          }
        }

        /* ==============================================
           RELEASED STAGE
        ============================================== */

        if (
          clearance.stage ===
            "Released by Customs" ||
          clearance.stage ===
            "Given to Our Agent"
        ) {
          if (
            !clearance.releasedAt
          ) {
            clearance.releasedAt =
              now;
          }
        }

        /* ==============================================
           AGENT RECEIVED
        ============================================== */

        if (
          clearance.stage ===
          "Given to Our Agent"
        ) {
          clearance.progress =
            100;

          clearance.status =
            "Completed";

          if (
            !clearance.agentReceivedAt
          ) {
            clearance.agentReceivedAt =
              now;
          }

          if (
            !clearance.completedAt
          ) {
            clearance.completedAt =
              now;
          }
        }

        /* ==============================================
           100% ALWAYS MEANS COMPLETED
        ============================================== */

        if (
          clearance.progress ===
            100
        ) {
          clearance.status =
            "Completed";

          if (
            !clearance.completedAt
          ) {
            clearance.completedAt =
              now;
          }
        }

        /* ==============================================
           COMPLETED CUSTOMS MUST BE 100%
        ============================================== */

        if (
          clearance.status ===
            "Completed" &&
          clearance.progress < 100
        ) {
          clearance.progress =
            100;

          if (
            !clearance.completedAt
          ) {
            clearance.completedAt =
              now;
          }
        }
      }
    );

    next();
  }
);

/* =========================================================
   CUSTOMS SUMMARY SYNCHRONIZATION
=========================================================

The customsClearances[] array is the source of truth.

The summary fields:

- customsStage
- customs.stage
- customs.progress
- customs.startedAt
- customs.checkedAt
- customs.releasedAt
- customs.agentReceivedAt

are maintained for compatibility with the
frontend and controller.
========================================================= */

shipmentSchema.pre(
  "save",
  function (next) {
    if (
      !Array.isArray(
        this.customsClearances
      ) ||
      this.customsClearances.length === 0
    ) {
      /*
       * No customs history.
       */

      this.customsStage = null;

      if (!this.customs) {
        this.customs = {};
      }

      this.customs.stage = null;
      this.customs.progress = 0;
      this.customs.startedAt = null;
      this.customs.checkedAt = null;
      this.customs.releasedAt = null;
      this.customs.agentReceivedAt = null;

      return next();
    }

    /*
     * Find the most recent customs operation.
     *
     * The controller normally places the newest
     * customs operation at the end of the array.
     */

    const latest =
      this.customsClearances[
        this.customsClearances.length - 1
      ];

    if (!this.customs) {
      this.customs = {};
    }

    this.customsStage =
      latest.stage || null;

    this.customs.stage =
      latest.stage || null;

    this.customs.progress =
      Number(
        latest.progress ?? 0
      );

    this.customs.startedAt =
      latest.startedAt || null;

    this.customs.checkedAt =
      latest.checkedAt || null;

    this.customs.releasedAt =
      latest.releasedAt || null;

    this.customs.agentReceivedAt =
      latest.agentReceivedAt || null;

    if (
      latest.notes
    ) {
      this.customs.note =
        latest.notes;
    }

    next();
  }
);

/* =========================================================
   DELIVERY STATE SYNCHRONIZATION
========================================================= */

shipmentSchema.pre(
  "save",
  function (next) {
    /*
     * Delivered is the ONLY state that creates
     * the delivery lock.
     */

    if (
      this.status ===
      "Delivered"
    ) {
      this.progress = 100;

      this.isDelivered = true;

      if (
        !this.deliveredAt
      ) {
        this.deliveredAt =
          new Date();
      }

      return next();
    }

    /*
     * A shipment that has already been delivered
     * cannot move backwards.
     */

    if (
      this.isDelivered === true
    ) {
      this.status =
        "Delivered";

      this.progress = 100;

      if (
        !this.deliveredAt
      ) {
        this.deliveredAt =
          new Date();
      }
    }

    next();
  }
);

/* =========================================================
   FINAL OVERALL PROGRESS VALIDATION
========================================================= */

shipmentSchema.pre(
  "save",
  function (next) {
    /*
     * Customs reaching 100% does NOT affect
     * shipment.progress.
     */

    if (
      this.status !==
        "Delivered" &&
      this.progress >= 100
    ) {
      return next(
        new Error(
          "A shipment cannot have 100% overall progress unless it is Delivered."
        )
      );
    }

    /*
     * Delivered must always be 100%.
     */

    if (
      this.status ===
        "Delivered"
    ) {
      this.progress = 100;
    }

    next();
  }
);

/* =========================================================
   PREVENT INVALID CUSTOMS SUMMARY
========================================================= */

shipmentSchema.pre(
  "save",
  function (next) {
    if (!this.customs) {
      this.customs = {};
    }

    /*
     * Normalize current customs progress.
     */

    let customsProgress =
      Number(
        this.customs.progress
      );

    if (
      Number.isNaN(
        customsProgress
      )
    ) {
      customsProgress = 0;
    }

    this.customs.progress =
      Math.max(
        0,
        Math.min(
          100,
          Math.round(
            customsProgress
          )
        )
      );

    /*
     * If the current customs stage exists,
     * make sure its progress matches.
     */

    if (
      this.customs.stage &&
      CUSTOMS_PROGRESS[
        this.customs.stage
      ] !== undefined
    ) {
      this.customs.progress =
        CUSTOMS_PROGRESS[
          this.customs.stage
        ];
    }

    next();
  }
);

/* =========================================================
   EXPORT MODEL
========================================================= */

const Shipment =
  mongoose.models.Shipment ||
  mongoose.model(
    "Shipment",
    shipmentSchema
  );

export default Shipment;