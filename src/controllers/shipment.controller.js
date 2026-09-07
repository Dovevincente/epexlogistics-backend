import mongoose from "mongoose";
import Shipment from "../models/Shipment.js";
import Tracking from "../models/Tracking.js";
import generateTracking from "../utils/generateTracking.js";
import { sendEmail } from "../utils/email.js";

/* ======================================================
   🌍 GEOCODING
====================================================== */

const geocodeLocation = async (
  city,
  country = ""
) => {
  try {
    if (!city) {
      return {
        lat: null,
        lng: null,
      };
    }

    const queryText = country
      ? `${city}, ${country}`
      : String(city).trim();

    const query = encodeURIComponent(
      queryText
    );

    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?format=json&q=${query}&limit=1`;

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Epex Logistics/1.0 (admin@epexlogistics.com)",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.error(
        "Geocoding request failed:",
        response.status
      );

      return {
        lat: null,
        lng: null,
      };
    }

    const data =
      await response.json();

    if (
      Array.isArray(data) &&
      data.length > 0
    ) {
      const lat = Number(
        data[0].lat
      );

      const lng = Number(
        data[0].lon
      );

      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng)
      ) {
        return {
          lat,
          lng,
        };
      }
    }

    return {
      lat: null,
      lng: null,
    };
  } catch (error) {
    console.error(
      "Geocoding failed:",
      error.message
    );

    return {
      lat: null,
      lng: null,
    };
  }
};

/* ======================================================
   📍 SAFE COORDINATE VALIDATION
====================================================== */

const normalizeCoordinates = (
  lat,
  lng
) => {
  if (
    lat === undefined ||
    lat === null ||
    lng === undefined ||
    lng === null ||
    lat === "" ||
    lng === ""
  ) {
    return {
      lat: null,
      lng: null,
    };
  }

  const normalizedLat =
    Number(lat);

  const normalizedLng =
    Number(lng);

  if (
    !Number.isFinite(
      normalizedLat
    ) ||
    !Number.isFinite(
      normalizedLng
    )
  ) {
    return {
      lat: null,
      lng: null,
    };
  }

  if (
    normalizedLat < -90 ||
    normalizedLat > 90
  ) {
    return {
      lat: null,
      lng: null,
    };
  }

  if (
    normalizedLng < -180 ||
    normalizedLng > 180
  ) {
    return {
      lat: null,
      lng: null,
    };
  }

  return {
    lat: normalizedLat,
    lng: normalizedLng,
  };
};

/* ======================================================
   🔢 INVOICE NUMBER
====================================================== */

const generateInvoiceNumber =
  () => {
    return `INV-${Date.now()}-${Math.floor(
      100 + Math.random() * 900
    )}`;
  };

/* ======================================================
   💰 VAT
====================================================== */

const getVatPercentByCountry = (
  country
) => {
  if (!country) {
    return 0;
  }

  const c = String(country)
    .toLowerCase()
    .trim();

  if (c === "nigeria") {
    return 7.5;
  }

  if (
    c === "united kingdom" ||
    c === "uk"
  ) {
    return 20;
  }

  if (
    c === "united states" ||
    c === "usa" ||
    c === "us"
  ) {
    return 0;
  }

  return 0;
};

/* ======================================================
   📅 DELIVERY DATE
====================================================== */

const calculateEstimatedDelivery =
  (deliveryRange) => {
    if (!deliveryRange) {
      return null;
    }

    const normalizedRange =
      String(deliveryRange)
        .toLowerCase()
        .replace(/[–—]/g, "-")
        .replace(/\s+/g, "")
        .trim();

    const today = new Date();

    let daysToAdd = null;

    if (
      normalizedRange.startsWith(
        "1-3"
      )
    ) {
      daysToAdd = 2;
    } else if (
      normalizedRange.startsWith(
        "6-10"
      )
    ) {
      daysToAdd = 8;
    }

    if (daysToAdd === null) {
      return null;
    }

    const estimatedDelivery =
      new Date(today);

    estimatedDelivery.setDate(
      estimatedDelivery.getDate() +
        daysToAdd
    );

    return estimatedDelivery;
  };

/* ======================================================
   🚚 ALLOWED SHIPMENT STATUSES
====================================================== */

const ALLOWED_STATUSES = [
  "Booked",
  "Picked Up",
  "In Transit",
  "Customs Clearance",
  "On Hold",
  "Out for Delivery",
  "Delivered",
];

/* ======================================================
   🚚 OVERALL SHIPMENT PROGRESS
======================================================

   IMPORTANT:

   This percentage represents ONLY the shipment journey.

   Customs progress NEVER changes this value.

   Booked            = 0%
   Picked Up         = 20%
   In Transit        = 60%
   Customs Clearance = 60%
   On Hold           = 60%
   Out for Delivery  = 90%
   Delivered         = 100%
====================================================== */

const STATUS_PROGRESS = {
  Booked: 0,
  "Picked Up": 20,
  "In Transit": 60,
  "Customs Clearance": 60,
  "On Hold": 60,
  "Out for Delivery": 90,
  Delivered: 100,
};

/* ======================================================
   🛃 CUSTOMS STAGES
====================================================== */

const CUSTOMS_STAGES = [
  "Prepared for Customs",
  "Checked by Customs",
  "Released by Customs",
  "Given to Our Agent",
];

/* ======================================================
   🛃 CUSTOMS PROGRESS
====================================================== */

const CUSTOMS_PROGRESS = {
  "Prepared for Customs": 25,
  "Checked by Customs": 50,
  "Released by Customs": 75,
  "Given to Our Agent": 100,
};

/* ======================================================
   🛃 CUSTOMS STATUSES
====================================================== */

const CUSTOMS_STATUSES = [
  "In Progress",
  "Completed",
  "On Hold",
];

/* ======================================================
   🛃 OLD CUSTOMS ALIAS
====================================================== */

const CUSTOMS_STAGE_ALIASES = {
  "Shipment Given to Our Agent":
    "Given to Our Agent",
};

/* ======================================================
   🛃 NORMALIZE CUSTOMS STAGE
====================================================== */

const normalizeCustomsStage =
  (customsStage) => {
    if (!customsStage) {
      return null;
    }

    const value =
      String(customsStage).trim();

    return (
      CUSTOMS_STAGE_ALIASES[value] ||
      value
    );
  };

/* ======================================================
   🛃 CUSTOMS STAGE INDEX
====================================================== */

const getCustomsStageIndex =
  (customsStage) => {
    const normalizedStage =
      normalizeCustomsStage(
        customsStage
      );

    if (!normalizedStage) {
      return null;
    }

    const index =
      CUSTOMS_STAGES.indexOf(
        normalizedStage
      );

    return index === -1
      ? null
      : index;
  };

/* ======================================================
   🛃 NORMALIZE TEXT
====================================================== */

const normalizeText = (
  value
) => {
  return String(value || "")
    .trim()
    .toLowerCase();
};

/* ======================================================
   🛃 BUILD CUSTOMS LOCATION KEY
======================================================

   Airport code is preferred.

   If no airport code exists,
   airport name is used.

   If neither exists,
   city + country are used.
====================================================== */

const buildCustomsLocationKey =
  ({
    airport,
    airportCode,
    city,
    country,
  }) => {
    const normalizedAirportCode =
      normalizeText(
        airportCode
      );

    const normalizedAirport =
      normalizeText(
        airport
      );

    const normalizedCity =
      normalizeText(city);

    const normalizedCountry =
      normalizeText(country);

    if (
      normalizedAirportCode
    ) {
      return `code:${normalizedAirportCode}`;
    }

    if (normalizedAirport) {
      return `airport:${normalizedAirport}|${normalizedCountry}`;
    }

    return `location:${normalizedCity}|${normalizedCountry}`;
  };

/* ======================================================
   🛃 CHECK WHETHER CUSTOMS LOCATIONS MATCH
====================================================== */

const customsLocationsMatch = (
  clearance,
  {
    airport,
    airportCode,
    city,
    country,
  }
) => {
  const existingCode =
    normalizeText(
      clearance?.airportCode
    );

  const incomingCode =
    normalizeText(
      airportCode
    );

  /*
   * If both have airport codes,
   * compare the codes.
   */

  if (
    existingCode &&
    incomingCode
  ) {
    return (
      existingCode ===
      incomingCode
    );
  }

  const existingAirport =
    normalizeText(
      clearance?.airport
    );

  const incomingAirport =
    normalizeText(
      airport
    );

  /*
   * If airport names are available,
   * compare airport + country.
   */

  if (
    existingAirport &&
    incomingAirport
  ) {
    return (
      existingAirport ===
        incomingAirport &&
      normalizeText(
        clearance?.country
      ) ===
        normalizeText(country)
    );
  }

  /*
   * Fallback to city + country.
   */

  return (
    normalizeText(
      clearance?.city
    ) ===
      normalizeText(city) &&
    normalizeText(
      clearance?.country
    ) ===
      normalizeText(country)
  );
};

/* ======================================================
   🛃 CHECK CUSTOMS COMPLETION
====================================================== */

const isCustomsCompleted = (
  clearance
) => {
  if (!clearance) {
    return false;
  }

  return (
    clearance.status ===
      "Completed" ||
    Number(clearance.progress) ===
      100 ||
    Boolean(
      clearance.completedAt
    )
  );
};

/* ======================================================
   🛃 FIND ACTIVE CUSTOMS CLEARANCE
====================================================== */

const findActiveCustomsClearance =
  (
    shipment,
    location
  ) => {
    const clearances =
      Array.isArray(
        shipment.customsClearances
      )
        ? shipment.customsClearances
        : [];

    for (
      let i =
        clearances.length - 1;
      i >= 0;
      i--
    ) {
      const clearance =
        clearances[i];

      if (
        isCustomsCompleted(
          clearance
        )
      ) {
        continue;
      }

      if (
        customsLocationsMatch(
          clearance,
          location
        )
      ) {
        return {
          clearance,
          index: i,
        };
      }
    }

    return {
      clearance: null,
      index: -1,
    };
  };

/* ======================================================
   🛃 GET LATEST CUSTOMS CLEARANCE
====================================================== */

const getLatestCustomsClearance =
  (shipment) => {
    const clearances =
      Array.isArray(
        shipment.customsClearances
      )
        ? shipment.customsClearances
        : [];

    if (!clearances.length) {
      return null;
    }

    return clearances[
      clearances.length - 1
    ];
  };

/* ======================================================
   🛃 GET LATEST COMPLETED CUSTOMS
====================================================== */

const getLatestCompletedCustoms =
  (shipment) => {
    const clearances =
      Array.isArray(
        shipment.customsClearances
      )
        ? shipment.customsClearances
        : [];

    for (
      let i =
        clearances.length - 1;
      i >= 0;
      i--
    ) {
      if (
        isCustomsCompleted(
          clearances[i]
        )
      ) {
        return clearances[i];
      }
    }

    return null;
  };

/* ======================================================
   🛃 CREATE NEW CUSTOMS CLEARANCE
====================================================== */

const createCustomsClearance =
  ({
    airport,
    airportCode,
    terminal,
    city,
    country,
    coordinates,
    stage,
    notes,
  }) => {
    const now = new Date();

    const normalizedStage =
      normalizeCustomsStage(
        stage
      ) ||
      "Prepared for Customs";

    const progress =
      CUSTOMS_PROGRESS[
        normalizedStage
      ];

    return {
      airport:
        String(
          airport || ""
        ).trim(),

      airportCode:
        String(
          airportCode || ""
        )
          .trim()
          .toUpperCase(),

      terminal:
        String(
          terminal || ""
        ).trim(),

      city:
        String(
          city || ""
        ).trim(),

      country:
        String(
          country || ""
        ).trim(),

      status:
        normalizedStage ===
        "Given to Our Agent"
          ? "Completed"
          : "In Progress",

      stage:
        normalizedStage,

      progress:
        progress ?? 25,

      startedAt:
        now,

      checkedAt:
        normalizedStage ===
        "Checked by Customs"
          ? now
          : null,

      releasedAt:
        normalizedStage ===
        "Released by Customs"
          ? now
          : null,

      agentReceivedAt:
        normalizedStage ===
        "Given to Our Agent"
          ? now
          : null,

      completedAt:
        normalizedStage ===
        "Given to Our Agent"
          ? now
          : null,

      notes:
        String(
          notes || ""
        ).trim(),

      lat:
        coordinates?.lat ??
        null,

      lng:
        coordinates?.lng ??
        null,
    };
  };

/* ======================================================
   🛃 APPLY CUSTOMS STAGE
====================================================== */

const applyCustomsStage =
  (
    clearance,
    stage,
    notes
  ) => {
    const now = new Date();

    const normalizedStage =
      normalizeCustomsStage(
        stage
      );

    if (
      !normalizedStage ||
      !CUSTOMS_STAGES.includes(
        normalizedStage
      )
    ) {
      throw new Error(
        "Invalid customs stage"
      );
    }

    clearance.stage =
      normalizedStage;

    clearance.progress =
      CUSTOMS_PROGRESS[
        normalizedStage
      ];

    if (
      notes !== undefined
    ) {
      clearance.notes =
        String(
          notes || ""
        ).trim();
    }

    if (
      !clearance.startedAt
    ) {
      clearance.startedAt =
        now;
    }

    /*
     * Checked
     */

    if (
      normalizedStage ===
        "Checked by Customs" ||
      normalizedStage ===
        "Released by Customs" ||
      normalizedStage ===
        "Given to Our Agent"
    ) {
      if (
        !clearance.checkedAt
      ) {
        clearance.checkedAt =
          now;
      }
    }

    /*
     * Released
     */

    if (
      normalizedStage ===
        "Released by Customs" ||
      normalizedStage ===
        "Given to Our Agent"
    ) {
      if (
        !clearance.releasedAt
      ) {
        clearance.releasedAt =
          now;
      }
    }

    /*
     * Given to agent
     * means customs is complete.
     */

    if (
      normalizedStage ===
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
    } else {
      clearance.status =
        "In Progress";

      /*
       * Do not leave a stale completion date
       * if an admin corrects the stage backwards.
       */

      clearance.completedAt =
        null;
    }
  };

/* ======================================================
   🛃 PAUSE INCOMPLETE CUSTOMS
====================================================== */

const pauseIncompleteCustoms =
  (shipment) => {
    if (
      !Array.isArray(
        shipment.customsClearances
      )
    ) {
      return;
    }

    const latest =
      shipment.customsClearances[
        shipment.customsClearances
          .length - 1
      ];

    if (
      !latest ||
      isCustomsCompleted(
        latest
      )
    ) {
      return;
    }

    latest.status =
      "On Hold";
  };

/* ======================================================
   🛃 SYNC CURRENT CUSTOMS SUMMARY
====================================================== */

const syncCustomsSummary =
  (shipment, clearance) => {
    if (!shipment.customs) {
      shipment.customs = {};
    }

    if (!clearance) {
      shipment.customsStage =
        null;

      shipment.customs.stage =
        null;

      shipment.customs.progress =
        0;

      shipment.customs.startedAt =
        null;

      shipment.customs.checkedAt =
        null;

      shipment.customs.releasedAt =
        null;

      shipment.customs.agentReceivedAt =
        null;

      return;
    }

    shipment.customsStage =
      clearance.stage ||
      null;

    shipment.customs.stage =
      clearance.stage ||
      null;

    shipment.customs.progress =
      Number(
        clearance.progress ?? 0
      );

    shipment.customs.startedAt =
      clearance.startedAt ||
      null;

    shipment.customs.checkedAt =
      clearance.checkedAt ||
      null;

    shipment.customs.releasedAt =
      clearance.releasedAt ||
      null;

    shipment.customs.agentReceivedAt =
      clearance.agentReceivedAt ||
      null;

    /*
     * IMPORTANT:
     *
     * This does NOT modify shipment.progress.
     */
  };

/* ======================================================
   📦 SHIPMENT SNAPSHOT
====================================================== */

const buildShipmentSnapshot =
  (shipment) => {
    return {
      origin:
        shipment.origin,

      destination:
        shipment.destination,

      weight:
        shipment.weight,

      quantity:
        shipment.quantity,

      price:
        shipment.price,

      deliveryRange:
        shipment.deliveryRange,

      estimatedDelivery:
        shipment.estimatedDelivery,
    };
  };

/* ======================================================
   👤 SENDER SNAPSHOT
====================================================== */

const buildSenderSnapshot =
  (shipment) => {
    return {
      name:
        shipment.sender?.name ||
        "",

      email:
        shipment.sender?.email ||
        "",

      phone:
        shipment.sender?.phone ||
        "",

      address:
        shipment.sender?.address ||
        "",
    };
  };

/* ======================================================
   👤 RECEIVER SNAPSHOT
====================================================== */

const buildReceiverSnapshot =
  (shipment) => {
    return {
      name:
        shipment.receiver?.name ||
        "",

      email:
        shipment.receiver?.email ||
        "",

      phone:
        shipment.receiver?.phone ||
        "",

      address:
        shipment.receiver?.address ||
        "",
    };
  };

/* ======================================================
   📧 ESCAPE HTML
====================================================== */

const escapeHtml = (
  value
) => {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value)
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
};

/* ======================================================
   📦 GET ALL SHIPMENTS
====================================================== */

export const getShipments =
  async (req, res) => {
    try {
      const shipments =
        await Shipment.find()
          .populate(
            "customer",
            "name email"
          )
          .populate("quote")
          .sort({
            createdAt: -1,
          });

      res.json(shipments);
    } catch (error) {
      console.error(
        "Fetch shipments error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to fetch shipments",
      });
    }
  };

/* ======================================================
   📦 GET SINGLE SHIPMENT
====================================================== */

export const getShipment =
  async (req, res) => {
    try {
      const { id } =
        req.params;

      if (
        !mongoose.Types.ObjectId.isValid(
          id
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid shipment ID",
        });
      }

      const shipment =
        await Shipment.findById(id)
          .populate(
            "customer",
            "name email"
          )
          .populate("quote");

      if (!shipment) {
        return res.status(404).json({
          message:
            "Shipment not found",
        });
      }

      res.json(shipment);
    } catch (error) {
      console.error(
        "Get shipment error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to fetch shipment",
      });
    }
  };

/* ======================================================
   📦 CREATE SHIPMENT
====================================================== */

export const createShipment =
  async (req, res) => {
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

      /* ==================================================
         VALIDATION
      ================================================== */

      if (
        !sender?.name ||
        !sender?.phone ||
        !sender?.address ||
        !receiver?.name ||
        !receiver?.phone ||
        !receiver?.address ||
        !origin ||
        !destination ||
        weight ===
          undefined ||
        weight === null ||
        deliveryRange ===
          undefined ||
        deliveryRange === null ||
        price ===
          undefined ||
        price === null ||
        !city ||
        !country
      ) {
        return res.status(400).json({
          message:
            "Missing required shipment details",
        });
      }

      /* ==================================================
         CUSTOMER ID
      ================================================== */

      if (
        customer &&
        !mongoose.Types.ObjectId.isValid(
          customer
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid customer ID",
        });
      }

      /* ==================================================
         QUOTE ID
      ================================================== */

      if (
        quote &&
        !mongoose.Types.ObjectId.isValid(
          quote
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid quote ID",
        });
      }

      /* ==================================================
         NUMBERS
      ================================================== */

      const numericWeight =
        Number(weight);

      const numericQuantity =
        quantity ===
          undefined ||
        quantity === null ||
        quantity === ""
          ? 1
          : Number(quantity);

      const subtotal =
        Number(price);

      if (
        !Number.isFinite(
          numericWeight
        ) ||
        numericWeight <= 0
      ) {
        return res.status(400).json({
          message:
            "Weight must be greater than 0",
        });
      }

      if (
        !Number.isFinite(
          numericQuantity
        ) ||
        numericQuantity < 1
      ) {
        return res.status(400).json({
          message:
            "Quantity must be at least 1",
        });
      }

      if (
        !Number.isFinite(
          subtotal
        ) ||
        subtotal < 0
      ) {
        return res.status(400).json({
          message:
            "Price must be a valid amount",
        });
      }

      /* ==================================================
         DELIVERY DATE
      ================================================== */

      const estimatedDelivery =
        calculateEstimatedDelivery(
          deliveryRange
        );

      if (!estimatedDelivery) {
        return res.status(400).json({
          message:
            "Invalid delivery range. Use 1–3 or 6–10 business days",
        });
      }

      /* ==================================================
         VAT
      ================================================== */

      const vatPercent =
        getVatPercentByCountry(
          country
        );

      const tax =
        (subtotal *
          vatPercent) /
        100;

      const discount = 0;

      const total =
        subtotal +
        tax -
        discount;

      /* ==================================================
         IDENTIFIERS
      ================================================== */

      const trackingNumber =
        generateTracking();

      const invoiceNumber =
        generateInvoiceNumber();

      /* ==================================================
         GEOCODE ORIGIN
      ================================================== */

      let originCoordinates =
        await geocodeLocation(
          origin
        );

      if (
        originCoordinates.lat ===
          null ||
        originCoordinates.lng ===
          null
      ) {
        originCoordinates =
          await geocodeLocation(
            city,
            country
          );
      }

      /* ==================================================
         GEOCODE DESTINATION
      ================================================== */

      const destinationCoordinates =
        await geocodeLocation(
          destination
        );

      /* ==================================================
         CREATE SHIPMENT
      ================================================== */

      const shipment =
        await Shipment.create({
          trackingNumber,

          customer:
            customer || null,

          quote:
            quote || null,

          sender: {
            name:
              sender.name,

            email:
              sender.email || "",

            phone:
              sender.phone,

            address:
              sender.address,
          },

          receiver: {
            name:
              receiver.name,

            email:
              receiver.email || "",

            phone:
              receiver.phone,

            address:
              receiver.address,
          },

          origin:
            String(
              origin
            ).trim(),

          destination:
            String(
              destination
            ).trim(),

          city:
            String(
              city
            ).trim(),

          country:
            String(
              country
            ).trim(),

          currentLocation: {
            city:
              String(
                city
              ).trim(),

            country:
              String(
                country
              ).trim(),

            lat:
              originCoordinates.lat,

            lng:
              originCoordinates.lng,

            updatedAt:
              new Date(),
          },

          weight:
            numericWeight,

          quantity:
            numericQuantity,

          deliveryRange:
            String(
              deliveryRange
            ).trim(),

          estimatedDelivery,

          price:
            subtotal,

          invoice: {
            subtotal,

            vatPercent,

            tax,

            discount,

            total,

            currency:
              "$",
          },

          paymentMethod:
            paymentMethod ||
            "Cash",

          invoiceStatus:
            "Paid",

          invoiceNumber,

          invoiceIssuedAt:
            new Date(),

          paidAt:
            new Date(),

          invoicePublic:
            true,

          invoiceWatermark:
            "PAID",

          adminNote:
            adminNote || "",

          /* ============================================
             OVERALL SHIPMENT
          ============================================ */

          status:
            "Booked",

          progress:
            0,

          /* ============================================
             CURRENT CUSTOMS SUMMARY
          ============================================ */

          customsStage:
            null,

          customs: {
            stage:
              null,

            progress:
              0,

            startedAt:
              null,

            checkedAt:
              null,

            releasedAt:
              null,

            agentReceivedAt:
              null,

            note:
              "",
          },

          /* ============================================
             CUSTOMS HISTORY
          ============================================ */

          customsClearances:
            [],

          isDelivered:
            false,

          deliveredAt:
            null,
        });

      /* ==================================================
         INITIAL TRACKING EVENT
      ================================================== */

      const initialTracking =
        await Tracking.create({
          shipment:
            shipment._id,

          trackingNumber,

          status:
            "Booked",

          /*
           * OVERALL SHIPMENT PROGRESS
           */
          progress:
            0,

          /*
           * CUSTOMS PROGRESS IS SEPARATE
           */
          customsProgress:
            0,

          customsStage:
            null,

          customsStageIndex:
            null,

          city:
            shipment.city,

          country:
            shipment.country,

          lat:
            originCoordinates.lat,

          lng:
            originCoordinates.lng,

          originLat:
            originCoordinates.lat,

          originLng:
            originCoordinates.lng,

          destinationLat:
            destinationCoordinates.lat,

          destinationLng:
            destinationCoordinates.lng,

          destinationCity:
            shipment.destination,

          destinationCountry:
            "",

          estimatedArrival:
            shipment.estimatedDelivery,

          message:
            "Shipment booked. Thank you for choosing Epex Logistics",

          sender:
            buildSenderSnapshot(
              shipment
            ),

          receiver:
            buildReceiverSnapshot(
              shipment
            ),

          shipmentInfo:
            buildShipmentSnapshot(
              shipment
            ),
        });

      /* ==================================================
         EMAIL
      ================================================== */

      if (
        shipment.sender?.email
      ) {
        try {
          await sendEmail({
            to:
              shipment.sender.email,

            subject:
              `Shipment Booked – ${trackingNumber}`,

            html: `
              <div style="font-family:Arial,sans-serif;line-height:1.6;color:#222">

                <h2>📦 Shipment Successfully Booked</h2>

                <p>
                  Hello ${escapeHtml(
                    shipment.sender.name
                  )},
                </p>

                <p>
                  Your shipment has been created successfully with Epex Logistics.
                </p>

                <p>
                  <strong>Tracking Number:</strong>
                  ${escapeHtml(
                    trackingNumber
                  )}
                </p>

                <p>
                  <strong>Route:</strong>
                  ${escapeHtml(
                    origin
                  )}
                  →
                  ${escapeHtml(
                    destination
                  )}
                </p>

                <p>
                  <strong>Estimated Delivery:</strong>
                  ${estimatedDelivery.toDateString()}
                </p>

                <hr />

                <p>
                  Track your shipment anytime:
                  <br />
                  https://epexlogistics.com/track
                </p>

                <br />

                <strong>Epex Logistics</strong>
                <br />
                support@epexlogistics.com

              </div>
            `,
          });
        } catch (emailError) {
          console.error(
            "Shipment creation email failed:",
            emailError.message
          );
        }
      }

      /* ==================================================
         RESPONSE
      ================================================== */

      res.status(201).json({
        message:
          "Shipment created successfully",

        shipment,

        tracking:
          initialTracking,
      });
    } catch (error) {
      console.error(
        "Create shipment error:",
        error
      );

      if (
        error.code === 11000
      ) {
        return res.status(400).json({
          message:
            "Tracking number or invoice number already exists. Please try again.",
        });
      }

      res.status(500).json({
        message:
          error.message ||
          "Failed to create shipment",
      });
    }
  };

/* ======================================================
   🧾 PUBLIC INVOICE
====================================================== */

export const getPublicShipmentInvoice =
  async (req, res) => {
    try {
      const {
        trackingNumber,
      } = req.params;

      if (!trackingNumber) {
        return res.status(400).json({
          message:
            "Tracking number is required",
        });
      }

      const shipment =
        await Shipment.findOne({
          trackingNumber:
            String(
              trackingNumber
            )
              .trim()
              .toUpperCase(),
        });

      if (
        !shipment ||
        shipment.invoicePublic !==
          true
      ) {
        return res.status(404).json({
          message:
            "Invoice not found or not public",
        });
      }

      res.json({
        invoice: {
          invoiceNumber:
            shipment.invoiceNumber,

          issuedAt:
            shipment.invoiceIssuedAt,

          status:
            shipment.invoiceStatus,

          watermark:
            shipment.invoiceWatermark,
        },

        shipment: {
          trackingNumber:
            shipment.trackingNumber,

          origin:
            shipment.origin,

          destination:
            shipment.destination,

          weight:
            shipment.weight,

          quantity:
            shipment.quantity,

          deliveryRange:
            shipment.deliveryRange,

          estimatedDelivery:
            shipment.estimatedDelivery,

          status:
            shipment.status,

          /*
           * OVERALL SHIPMENT PROGRESS
           */
          progress:
            shipment.progress ??
            0,

          /*
           * CURRENT CUSTOMS SUMMARY
           */
          customsStage:
            shipment.customsStage ||
            null,

          customs:
            shipment.customs ||
            null,

          /*
           * COMPLETE CUSTOMS HISTORY
           */
          customsClearances:
            shipment.customsClearances ||
            [],

          currentLocation:
            shipment.currentLocation ||
            null,
        },

        sender:
          shipment.sender,

        receiver:
          shipment.receiver,

        payment: {
          method:
            shipment.paymentMethod,

          subtotal:
            shipment.invoice
              ?.subtotal ??
            0,

          vatPercent:
            shipment.invoice
              ?.vatPercent ??
            0,

          tax:
            shipment.invoice
              ?.tax ??
            0,

          discount:
            shipment.invoice
              ?.discount ??
            0,

          total:
            shipment.invoice
              ?.total ??
            0,

          currency:
            shipment.invoice
              ?.currency ||
            "$",

          paidAt:
            shipment.paidAt,
        },
      });
    } catch (error) {
      console.error(
        "Public invoice fetch error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to fetch invoice",
      });
    }
  };

/* ======================================================
   🧾 ADMIN INVOICE
====================================================== */

export const getShipmentInvoice =
  async (req, res) => {
    try {
      const { id } =
        req.params;

      if (
        !mongoose.Types.ObjectId.isValid(
          id
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid shipment ID",
        });
      }

      const shipment =
        await Shipment.findById(id);

      if (!shipment) {
        return res.status(404).json({
          message:
            "Shipment not found",
        });
      }

      res.json({
        invoice: {
          invoiceNumber:
            shipment.invoiceNumber,

          issuedAt:
            shipment.invoiceIssuedAt,

          status:
            shipment.invoiceStatus,

          watermark:
            shipment.invoiceWatermark,
        },

        shipment,

        payment:
          shipment.invoice,
      });
    } catch (error) {
      console.error(
        "Invoice fetch error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to fetch invoice",
      });
    }
  };

/* ======================================================
   🚚 UPDATE SHIPMENT STATUS
======================================================

   THIS FUNCTION CONTROLS TWO COMPLETELY SEPARATE
   PROGRESS SYSTEMS.

   SYSTEM 1:
   shipment.progress

   SYSTEM 2:
   customsClearances[].progress

   CUSTOMS 100% DOES NOT EQUAL SHIPMENT 100%.

   ONLY "Delivered" = shipment.progress 100%.
====================================================== */

export const updateShipmentStatus =
  async (req, res) => {
    try {
      const {
        status,
        city,
        country,
        message,

        lat,
        lng,
        coordinates,

        customsStage,

        airport,
        airportCode,
        terminal,

        customsNotes,

        estimatedArrival,
      } = req.body;

      /* ==================================================
         BASIC VALIDATION
      ================================================== */

      if (
        !status ||
        !city ||
        !country
      ) {
        return res.status(400).json({
          message:
            "Status, city and country are required",
        });
      }

      if (
        !ALLOWED_STATUSES.includes(
          status
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid shipment status",
        });
      }

      /* ==================================================
         CUSTOMS STAGE
      ================================================== */

      let normalizedCustomsStage =
        null;

      if (
        status ===
        "Customs Clearance"
      ) {
        normalizedCustomsStage =
          normalizeCustomsStage(
            customsStage
          );

        /*
         * If the admin enters Customs Clearance
         * without selecting a stage, start from scratch.
         */

        if (
          !normalizedCustomsStage
        ) {
          normalizedCustomsStage =
            "Prepared for Customs";
        }

        if (
          !CUSTOMS_STAGES.includes(
            normalizedCustomsStage
          )
        ) {
          return res.status(400).json({
            message:
              "Invalid customs stage",
          });
        }
      }

      /*
       * Customs stage cannot be attached to
       * normal shipment statuses.
       */

      if (
        status !==
          "Customs Clearance" &&
        customsStage
      ) {
        return res.status(400).json({
          message:
            "Customs stage can only be used with Customs Clearance status",
        });
      }

      /* ==================================================
         FIND SHIPMENT
      ================================================== */

      const { id } =
        req.params;

      if (
        !mongoose.Types.ObjectId.isValid(
          id
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid shipment ID",
        });
      }

      const shipment =
        await Shipment.findById(id);

      if (!shipment) {
        return res.status(404).json({
          message:
            "Shipment not found",
        });
      }

      /* ==================================================
         DELIVERY LOCK
      ==================================================

         ONLY Delivered locks the shipment.

         Customs 100% DOES NOT lock it.
      ================================================== */

      if (
        shipment.isDelivered ===
        true
      ) {
        return res.status(400).json({
          message:
            "Shipment already delivered. Updates are locked.",
        });
      }

      /* ==================================================
         REMEMBER PREVIOUS STATE
      ================================================== */

      const previousStatus =
        shipment.status;

      const wasInCustoms =
        previousStatus ===
        "Customs Clearance";

      const previousCustomsStage =
        shipment.customsStage ||
        shipment.customs?.stage ||
        null;

      const previousCustomsProgress =
        Number(
          shipment.customs
            ?.progress ?? 0
        );

      /* ==================================================
         OVERALL SHIPMENT PROGRESS
      ==================================================

         IMPORTANT:

         We deliberately DO NOT use req.body.progress.

         The backend determines overall shipment progress
         from the shipment status.

         This prevents the frontend from accidentally
         sending customs progress as shipment progress.
      ================================================== */

      const shipmentProgress =
        STATUS_PROGRESS[
          status
        ];

      if (
        shipmentProgress ===
        undefined
      ) {
        return res.status(400).json({
          message:
            "Unable to determine shipment progress from status",
        });
      }

      /* ==================================================
         LOCATION COORDINATES
      ================================================== */

      let finalCoordinates =
        normalizeCoordinates(
          lat,
          lng
        );

      if (
        finalCoordinates.lat ===
          null ||
        finalCoordinates.lng ===
          null
      ) {
        finalCoordinates =
          normalizeCoordinates(
            coordinates?.lat,
            coordinates?.lng
          );
      }

      if (
        finalCoordinates.lat ===
          null ||
        finalCoordinates.lng ===
          null
      ) {
        finalCoordinates =
          await geocodeLocation(
            city,
            country
          );
      }

      /* ==================================================
         EXISTING ROUTE COORDINATES
      ================================================== */

      const firstTracking =
        await Tracking.findOne({
          shipment:
            shipment._id,
        }).sort({
          createdAt: 1,
        });

      let originLat =
        firstTracking?.originLat ??
        null;

      let originLng =
        firstTracking?.originLng ??
        null;

      let destinationLat =
        firstTracking?.destinationLat ??
        null;

      let destinationLng =
        firstTracking?.destinationLng ??
        null;

      /* ==================================================
         ORIGIN COORDINATES
      ================================================== */

      if (
        originLat === null ||
        originLng === null
      ) {
        const originCoordinates =
          await geocodeLocation(
            shipment.origin
          );

        originLat =
          originCoordinates.lat;

        originLng =
          originCoordinates.lng;

        /*
         * Fallback to original shipment location.
         */

        if (
          originLat === null ||
          originLng === null
        ) {
          const fallbackOrigin =
            await geocodeLocation(
              shipment.city,
              shipment.country
            );

          originLat =
            fallbackOrigin.lat;

          originLng =
            fallbackOrigin.lng;
        }
      }

      /* ==================================================
         DESTINATION COORDINATES
      ================================================== */

      if (
        destinationLat === null ||
        destinationLng === null
      ) {
        const destinationCoordinates =
          await geocodeLocation(
            shipment.destination
          );

        destinationLat =
          destinationCoordinates.lat;

        destinationLng =
          destinationCoordinates.lng;
      }

      /* ==================================================
         DELIVERED = DESTINATION
      ================================================== */

      if (
        status ===
          "Delivered" &&
        destinationLat !== null &&
        destinationLng !== null
      ) {
        finalCoordinates = {
          lat:
            destinationLat,

          lng:
            destinationLng,
        };
      }

      /* ==================================================
         CUSTOMS VARIABLES
      ================================================== */

      let currentCustomsProgress =
        previousCustomsProgress;

      let currentCustomsStage =
        previousCustomsStage;

      let customsStageIndex =
        null;

      let currentCustomsClearance =
        null;

      /* ==================================================
         CUSTOMS CLEARANCE
      ================================================== */

      if (
        status ===
        "Customs Clearance"
      ) {
        /*
         * Make sure the array exists.
         */

        if (
          !Array.isArray(
            shipment.customsClearances
          )
        ) {
          shipment.customsClearances =
            [];
        }

        /* ==============================================
           CUSTOMS LOCATION
        ============================================== */

        const customsLocation = {
          airport:
            airport || "",

          airportCode:
            airportCode || "",

          city:
            String(city).trim(),

          country:
            String(country).trim(),
        };

        /* ==============================================
           FIND ACTIVE CUSTOMS
        ============================================== */

        let activeResult =
          {
            clearance: null,
            index: -1,
          };

        /*
         * If we are already inside the same
         * Customs Clearance status, update the
         * existing unfinished operation.
         */

        if (wasInCustoms) {
          activeResult =
            findActiveCustomsClearance(
              shipment,
              customsLocation
            );
        }

        /*
         * If the previous status was NOT Customs
         * Clearance, we intentionally start a NEW
         * customs operation.
         *
         * This is what allows:
         *
         * Madrid customs = 100%
         *
         * later
         *
         * Abu Dhabi customs = 25%
         *
         * without touching Madrid.
         */

        currentCustomsClearance =
          activeResult.clearance;

        /* ==============================================
           CREATE NEW CUSTOMS PROCESS
        ============================================== */

        if (
          !currentCustomsClearance
        ) {
          const newClearance =
            createCustomsClearance({
              airport,
              airportCode,
              terminal,
              city,
              country,
              coordinates:
                finalCoordinates,
              stage:
                normalizedCustomsStage,
              notes:
                customsNotes,
            });

          shipment.customsClearances.push(
            newClearance
          );

          currentCustomsClearance =
            shipment.customsClearances[
              shipment.customsClearances
                .length - 1
            ];
        }

        /* ==============================================
           UPDATE EXISTING CUSTOMS PROCESS
        ============================================== */

        else {
          /*
           * Update location information only when
           * supplied. Existing values are preserved.
           */

          if (airport) {
            currentCustomsClearance.airport =
              String(
                airport
              ).trim();
          }

          if (airportCode) {
            currentCustomsClearance.airportCode =
              String(
                airportCode
              )
                .trim()
                .toUpperCase();
          }

          if (terminal) {
            currentCustomsClearance.terminal =
              String(
                terminal
              ).trim();
          }

          currentCustomsClearance.city =
            String(city).trim();

          currentCustomsClearance.country =
            String(country).trim();

          currentCustomsClearance.lat =
            finalCoordinates.lat;

          currentCustomsClearance.lng =
            finalCoordinates.lng;

          applyCustomsStage(
            currentCustomsClearance,
            normalizedCustomsStage,
            customsNotes
          );
        }

        /*
         * For newly-created records,
         * createCustomsClearance already applied
         * the selected stage.

         * For existing records,
         * applyCustomsStage above did it.
         */

        currentCustomsProgress =
          Number(
            currentCustomsClearance.progress ??
              CUSTOMS_PROGRESS[
                normalizedCustomsStage
              ]
          );

        currentCustomsStage =
          currentCustomsClearance.stage;

        customsStageIndex =
          getCustomsStageIndex(
            currentCustomsStage
          );

        /*
         * Sync only the current customs summary.
         *
         * This DOES NOT touch shipment.progress.
         */

        syncCustomsSummary(
          shipment,
          currentCustomsClearance
        );
      }

      /* ==================================================
         LEAVING CUSTOMS
      ==================================================

         IMPORTANT:

         We preserve the customs history.

         If the latest customs operation was completed,
         it stays at 100%.

         If it was not completed, it is placed on hold
         instead of being deleted/reset.
      ================================================== */

      else {
        const latestCustoms =
          getLatestCustomsClearance(
            shipment
          );

        if (latestCustoms) {
          if (
            isCustomsCompleted(
              latestCustoms
            )
          ) {
            currentCustomsProgress =
              Number(
                latestCustoms.progress ??
                  100
              );

            currentCustomsStage =
              latestCustoms.stage ||
              "Given to Our Agent";
          } else {
            /*
             * Preserve the unfinished customs
             * process in history.
             */

            pauseIncompleteCustoms(
              shipment
            );

            currentCustomsProgress =
              Number(
                latestCustoms.progress ??
                  0
              );

            currentCustomsStage =
              latestCustoms.stage ||
              null;
          }
        }

        /*
         * We don't need to make customsStage
         * control the shipment anymore.
         *
         * Historical customs remains in:
         *
         * shipment.customsClearances[]
         */
      }

      /* ==================================================
         UPDATE SHIPMENT STATUS
      ================================================== */

      shipment.status =
        status;

      /* ==================================================
         UPDATE OVERALL PROGRESS
      ==================================================

         THIS IS ALWAYS BASED ON STATUS.

         Customs 100% cannot affect it.
      ================================================== */

      shipment.progress =
        shipmentProgress;

      /* ==================================================
         UPDATE CURRENT LOCATION
      ================================================== */

      shipment.city =
        String(city).trim();

      shipment.country =
        String(country).trim();

      shipment.currentLocation = {
        city:
          String(city).trim(),

        country:
          String(country).trim(),

        lat:
          finalCoordinates.lat,

        lng:
          finalCoordinates.lng,

        updatedAt:
          new Date(),
      };

      /* ==================================================
         CUSTOMS SUMMARY
      ================================================== */

      if (
        status ===
        "Customs Clearance"
      ) {
        /*
         * Currently inside customs:
         * show the active customs operation.
         */

        syncCustomsSummary(
          shipment,
          currentCustomsClearance
        );
      } else {
        /*
         * We are no longer inside customs.
         *
         * Keep the last customs result in the summary
         * for compatibility, while the complete history
         * remains in customsClearances[].
         */

        const latestCustoms =
          getLatestCustomsClearance(
            shipment
          );

        if (latestCustoms) {
          syncCustomsSummary(
            shipment,
            latestCustoms
          );
        } else {
          syncCustomsSummary(
            shipment,
            null
          );
        }
      }

      /* ==================================================
         DELIVERED
      ================================================== */

      if (
        status ===
        "Delivered"
      ) {
        /*
         * ONLY HERE does overall shipment
         * progress become 100%.
         */

        shipment.progress =
          100;

        shipment.isDelivered =
          true;

        shipment.deliveredAt =
          new Date();
      }

      /* ==================================================
         SAVE SHIPMENT
      ================================================== */

      await shipment.save();

      /* ==================================================
         FINAL CUSTOMS VALUES
      ================================================== */

      const latestSavedCustoms =
        getLatestCustomsClearance(
          shipment
        );

      const finalCustomsProgress =
        status ===
          "Customs Clearance"
          ? Number(
              currentCustomsProgress
            )
          : Number(
              latestSavedCustoms
                ?.progress ??
                shipment.customs
                  ?.progress ??
                0
            );

      const finalCustomsStage =
        status ===
          "Customs Clearance"
          ? currentCustomsStage
          : latestSavedCustoms
              ?.stage ||
            shipment.customsStage ||
            null;

      const finalCustomsStageIndex =
        getCustomsStageIndex(
          finalCustomsStage
        );

      /* ==================================================
         TRACKING EVENT
      ================================================== */

      const tracking =
        await Tracking.create({
          shipment:
            shipment._id,

          trackingNumber:
            shipment.trackingNumber,

          status,

          /*
           * ============================================
           * OVERALL SHIPMENT PROGRESS
           * ============================================
           */

          progress:
            shipment.progress,

          /*
           * ============================================
           * CUSTOMS PROGRESS
           * ============================================
           */

          customsProgress:
            finalCustomsProgress,

          customsStage:
            finalCustomsStage,

          customsStageIndex:
            finalCustomsStageIndex,

          city:
            String(city).trim(),

          country:
            String(country).trim(),

          lat:
            finalCoordinates.lat,

          lng:
            finalCoordinates.lng,

          originLat,

          originLng,

          destinationLat,

          destinationLng,

          destinationCity:
            shipment.destination,

          destinationCountry:
            "",

          estimatedArrival:
            estimatedArrival ||
            shipment.estimatedDelivery,

          message:
            message ||
            `${status} — ${city}, ${country}`,

          sender:
            buildSenderSnapshot(
              shipment
            ),

          receiver:
            buildReceiverSnapshot(
              shipment
            ),

          shipmentInfo:
            buildShipmentSnapshot(
              shipment
            ),
        });

      /* ==================================================
         EMAIL NOTIFICATION
      ================================================== */

      try {
        const recipients = [
          shipment.sender?.email,
          shipment.receiver?.email,
        ].filter(Boolean);

        if (
          recipients.length > 0
        ) {
          let customsText = "";

          if (
            status ===
            "Customs Clearance"
          ) {
            customsText = `
              <div style="
                margin:20px 0;
                padding:15px;
                border:1px solid #ddd;
                border-radius:8px;
              ">

                <h3>
                  🛃 Customs Clearance
                </h3>

                <p>
                  <strong>
                    Customs Airport:
                  </strong>
                  ${escapeHtml(
                    airport ||
                      currentCustomsClearance?.airport ||
                      city
                  )}
                </p>

                ${
                  airportCode
                    ? `
                      <p>
                        <strong>
                          Airport Code:
                        </strong>
                        ${escapeHtml(
                          airportCode
                        )}
                      </p>
                    `
                    : ""
                }

                ${
                  terminal
                    ? `
                      <p>
                        <strong>
                          Terminal:
                        </strong>
                        ${escapeHtml(
                          terminal
                        )}
                      </p>
                    `
                    : ""
                }

                <p>
                  <strong>
                    Customs Stage:
                  </strong>
                  ${escapeHtml(
                    finalCustomsStage
                  )}
                </p>

                <p>
                  <strong>
                    Customs Progress:
                  </strong>
                  ${finalCustomsProgress}%
                </p>

              </div>
            `;
          }

          await sendEmail({
            to:
              recipients,

            subject:
              `Shipment Update – ${shipment.trackingNumber}`,

            html: `
              <div style="
                font-family:Arial,sans-serif;
                line-height:1.6;
                color:#222;
              ">

                <h2>
                  📦 Shipment Status Updated
                </h2>

                <p>
                  <strong>
                    Tracking Number:
                  </strong>
                  ${escapeHtml(
                    shipment.trackingNumber
                  )}
                </p>

                <p>
                  <strong>
                    Status:
                  </strong>
                  ${escapeHtml(
                    status
                  )}
                </p>

                ${customsText}

                <p>
                  <strong>
                    Shipment Progress:
                  </strong>
                  ${shipment.progress}%
                </p>

                <p>
                  <strong>
                    Current Location:
                  </strong>
                  ${escapeHtml(
                    city
                  )},
                  ${escapeHtml(
                    country
                  )}
                </p>

                <p>
                  ${escapeHtml(
                    message ||
                      status
                  )}
                </p>

                <hr />

                <p>
                  Track your shipment:
                  <br />
                  https://epexlogistics.com/track
                </p>

                <br />

                <strong>
                  Epex Logistics
                </strong>
                <br />

                support@epexlogistics.com

              </div>
            `,
          });
        }
      } catch (emailError) {
        console.error(
          "Shipment email failed:",
          emailError.message
        );
      }

      /* ==================================================
         RESPONSE
      ================================================== */

      return res.json({
        message:
          "Shipment status, shipment progress, customs progress and location updated successfully",

        shipment,

        tracking,

        /*
         * ============================================
         * OVERALL SHIPMENT PROGRESS
         * ============================================
         */

        progress:
          shipment.progress,

        /*
         * ============================================
         * CURRENT CUSTOMS PROGRESS
         * ============================================
         */

        customsProgress:
          finalCustomsProgress,

        customsStage:
          finalCustomsStage,

        customsStageIndex:
          finalCustomsStageIndex,

        /*
         * ============================================
         * ALL CUSTOMS OPERATIONS
         * ============================================
         */

        customsClearances:
          shipment.customsClearances ||
          [],

        /*
         * ============================================
         * ACTIVE CUSTOMS OPERATION
         * ============================================
         */

        activeCustomsClearance:
          shipment.activeCustomsClearance ||
          null,

        /*
         * ============================================
         * LATEST CUSTOMS OPERATION
         * ============================================
         */

        latestCustomsClearance:
          shipment.latestCustomsClearance ||
          null,
      });
    } catch (error) {
      console.error(
        "Update shipment error:",
        error
      );

      /* ==================================================
         DUPLICATE KEY
      ================================================== */

      if (
        error.code === 11000
      ) {
        return res.status(400).json({
          message:
            "A duplicate shipment or tracking record was detected.",
        });
      }

      /* ==================================================
         TRACKING LOCK
      ================================================== */

      if (
        error.message?.includes(
          "Tracking is locked"
        )
      ) {
        return res.status(400).json({
          message:
            "Tracking is locked. Shipment already delivered.",
        });
      }

      /* ==================================================
         VALIDATION ERROR
      ================================================== */

      if (
        error.name ===
        "ValidationError"
      ) {
        return res.status(400).json({
          message:
            error.message ||
            "Shipment validation failed",
        });
      }

      /* ==================================================
         GENERAL ERROR
      ================================================== */

      return res.status(500).json({
        message:
          error.message ||
          "Failed to update shipment",
      });
    }
  };

/* ======================================================
   🗑️ DELETE SHIPMENT
====================================================== */

export const deleteShipment =
  async (req, res) => {
    try {
      const { id } =
        req.params;

      if (
        !mongoose.Types.ObjectId.isValid(
          id
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid shipment ID",
        });
      }

      const shipment =
        await Shipment.findById(id);

      if (!shipment) {
        return res.status(404).json({
          message:
            "Shipment not found",
        });
      }

      /*
       * Delete tracking history first.
       */

      await Tracking.deleteMany({
        shipment:
          shipment._id,
      });

      /*
       * Delete shipment.
       */

      await shipment.deleteOne();

      res.json({
        message:
          "Shipment deleted successfully",
      });
    } catch (error) {
      console.error(
        "Delete shipment error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to delete shipment",
      });
    }
  };