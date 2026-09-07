import mongoose from "mongoose";
import Shipment from "../models/Shipment.js";
import Tracking from "../models/Tracking.js";
import generateTracking from "../utils/generateTracking.js";
import { sendEmail } from "../utils/email.js";

/* ======================================================
   🌍 GEOCODING
====================================================== */

const geocodeLocation = async (city, country) => {
  try {
    if (!city || !country) {
      return {
        lat: null,
        lng: null,
      };
    }

    const query = encodeURIComponent(
      `${city}, ${country}`
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

    const data = await response.json();

    if (
      Array.isArray(data) &&
      data.length > 0
    ) {
      const lat = Number(data[0].lat);
      const lng = Number(data[0].lon);

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

  const normalizedLat = Number(lat);
  const normalizedLng = Number(lng);

  if (
    !Number.isFinite(normalizedLat) ||
    !Number.isFinite(normalizedLng)
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

const generateInvoiceNumber = () => {
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
  if (!country) return 0;

  const c = country
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

const calculateEstimatedDelivery = (
  deliveryRange
) => {
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

  /*
   * Approximate middle of delivery window.
   *
   * 1-3 days  → 2 days
   * 6-10 days → 8 days
   */

  let daysToAdd = null;

  if (
    normalizedRange.startsWith("1-3")
  ) {
    daysToAdd = 2;
  } else if (
    normalizedRange.startsWith("6-10")
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
   📊 VALIDATE PROGRESS
====================================================== */

const normalizeProgress = (
  progress,
  status,
  fallback = 0
) => {
  let value =
    progress !== undefined &&
    progress !== null &&
    progress !== ""
      ? Number(progress)
      : Number(fallback);

  if (!Number.isFinite(value)) {
    return null;
  }

  value = Math.round(value);

  if (value < 0 || value > 100) {
    return null;
  }

  if (status === "Delivered") {
    return 100;
  }

  return value;
};

/* ======================================================
   🚚 ALLOWED STATUSES
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
   🛃 CUSTOMS STAGES
====================================================== */

const CUSTOMS_STAGES = [
  "Prepared for Customs",
  "Checked by Customs",
  "Released by Customs",
  "Given to Our Agent",
];

/* ======================================================
   🛃 CUSTOMS STAGE INDEX
====================================================== */

const getCustomsStageIndex = (
  customsStage
) => {
  if (!customsStage) {
    return null;
  }

  const index =
    CUSTOMS_STAGES.indexOf(
      customsStage
    );

  return index === -1
    ? null
    : index;
};

/* ======================================================
   📦 SHIPMENT SNAPSHOT
====================================================== */

const buildShipmentSnapshot = (
  shipment
) => {
  return {
    origin: shipment.origin,

    destination:
      shipment.destination,

    weight: shipment.weight,

    quantity: shipment.quantity,

    price: shipment.price,

    deliveryRange:
      shipment.deliveryRange,

    estimatedDelivery:
      shipment.estimatedDelivery,
  };
};

/* ======================================================
   👤 SENDER SNAPSHOT
====================================================== */

const buildSenderSnapshot = (
  shipment
) => {
  return {
    name:
      shipment.sender?.name || "",

    email:
      shipment.sender?.email || "",

    phone:
      shipment.sender?.phone || "",

    address:
      shipment.sender?.address || "",
  };
};

/* ======================================================
   👤 RECEIVER SNAPSHOT
====================================================== */

const buildReceiverSnapshot = (
  shipment
) => {
  return {
    name:
      shipment.receiver?.name || "",

    email:
      shipment.receiver?.email || "",

    phone:
      shipment.receiver?.phone || "",

    address:
      shipment.receiver?.address || "",
  };
};

/* ======================================================
   📧 ESCAPE HTML
====================================================== */

const escapeHtml = (value) => {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

/* ======================================================
   📦 GET ALL SHIPMENTS
====================================================== */

export const getShipments = async (
  req,
  res
) => {
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

export const getShipment = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(id)
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

export const createShipment = async (
  req,
  res
) => {
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
      weight === undefined ||
      weight === null ||
      deliveryRange === undefined ||
      deliveryRange === null ||
      price === undefined ||
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
      quantity === undefined ||
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
      !Number.isFinite(subtotal) ||
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
      (subtotal * vatPercent) /
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

    const originCoordinates =
      await geocodeLocation(
        origin,
        ""
      );

    /*
     * If origin contains something like:
     * "Damascus, Syria"
     *
     * the helper above may not be enough because
     * origin is a free-form route string.
     *
     * We therefore try it directly first and
     * fall back to the shipment city/country.
     */

    let finalOriginCoordinates =
      originCoordinates;

    if (
      finalOriginCoordinates.lat ===
        null ||
      finalOriginCoordinates.lng ===
        null
    ) {
      finalOriginCoordinates =
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
        destination,
        ""
      );

    /*
     * Destination may also be a full free-form
     * address. If geocoding fails, we leave it null.
     */

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
          name: sender.name,
          email:
            sender.email || "",
          phone: sender.phone,
          address:
            sender.address,
        },

        receiver: {
          name: receiver.name,
          email:
            receiver.email || "",
          phone: receiver.phone,
          address:
            receiver.address,
        },

        origin:
          String(origin).trim(),

        destination:
          String(destination).trim(),

        city:
          String(city).trim(),

        country:
          String(country).trim(),

        currentLocation: {
          city:
            String(city).trim(),

          country:
            String(country).trim(),

          lat:
            finalOriginCoordinates.lat,

          lng:
            finalOriginCoordinates.lng,

          updatedAt:
            new Date(),
        },

        weight:
          numericWeight,

        quantity:
          numericQuantity,

        deliveryRange:
          String(deliveryRange).trim(),

        estimatedDelivery,

        price:
          subtotal,

        invoice: {
          subtotal,

          vatPercent,

          tax,

          discount,

          total,

          currency: "$",
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

        status:
          "Booked",

        progress:
          0,

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

        progress:
          0,

        city:
          shipment.city,

        country:
          shipment.country,

        lat:
          finalOriginCoordinates.lat,

        lng:
          finalOriginCoordinates.lng,

        originLat:
          finalOriginCoordinates.lat,

        originLng:
          finalOriginCoordinates.lng,

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
       EMAIL SENDER
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
          trackingNumber,
        });

      if (
        !shipment ||
        shipment.invoicePublic !== true
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

          progress:
            shipment.progress ?? 0,

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
              ?.subtotal ?? 0,

          vatPercent:
            shipment.invoice
              ?.vatPercent ?? 0,

          tax:
            shipment.invoice
              ?.tax ?? 0,

          discount:
            shipment.invoice
              ?.discount ?? 0,

          total:
            shipment.invoice
              ?.total ?? 0,

          currency:
            shipment.invoice
              ?.currency || "$",

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
      const { id } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(id)
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
   + PROGRESS
   + LOCATION
   + CUSTOMS STAGE
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
        progress,
        customsStage,
        estimatedArrival,
      } = req.body;

      /* ==================================================
         VALIDATION
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
         CUSTOMS VALIDATION
      ================================================== */

      if (
        status ===
          "Customs Clearance"
      ) {
        if (
          customsStage &&
          !CUSTOMS_STAGES.includes(
            customsStage
          )
        ) {
          return res.status(400).json({
            message:
              "Invalid customs stage",
          });
        }
      }

      /*
       * Customs stage must NOT be attached
       * to another shipment status.
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

      const { id } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(id)
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
      ================================================== */

      if (
        shipment.isDelivered
      ) {
        return res.status(400).json({
          message:
            "Shipment already delivered. Updates locked.",
        });
      }

      /* ==================================================
         PROGRESS
      ================================================== */

      const shipmentProgress =
        normalizeProgress(
          progress,
          status,
          shipment.progress ?? 0
        );

      if (
        shipmentProgress === null
      ) {
        return res.status(400).json({
          message:
            "Progress must be a valid number between 0 and 100",
        });
      }

      if (
        shipmentProgress ===
          100 &&
        status !== "Delivered"
      ) {
        return res.status(400).json({
          message:
            "A shipment at 100% progress must have Delivered status",
        });
      }

      /* ==================================================
         LOCATION
      ================================================== */

      let coordinates =
        normalizeCoordinates(
          lat,
          lng
        );

      /*
       * If admin didn't provide coordinates,
       * geocode the supplied city/country.
       */

      if (
        coordinates.lat === null ||
        coordinates.lng === null
      ) {
        coordinates =
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
         IF ORIGIN COORDINATES DON'T EXIST
         TRY TO GEOCODE SHIPMENT CITY/COUNTRY
      ================================================== */

      if (
        originLat === null ||
        originLng === null
      ) {
        const origin =
          await geocodeLocation(
            shipment.city,
            shipment.country
          );

        originLat = origin.lat;
        originLng = origin.lng;
      }

      /* ==================================================
         DESTINATION COORDINATES
      ================================================== */

      if (
        destinationLat === null ||
        destinationLng === null
      ) {
        const destination =
          await geocodeLocation(
            shipment.destination,
            ""
          );

        destinationLat =
          destination.lat;

        destinationLng =
          destination.lng;
      }

      /* ==================================================
         DELIVERED = DESTINATION
      ================================================== */

      if (
        status === "Delivered" &&
        destinationLat !== null &&
        destinationLng !== null
      ) {
        coordinates = {
          lat: destinationLat,
          lng: destinationLng,
        };
      }

      /* ==================================================
         CUSTOMS STAGE INDEX
      ================================================== */

      const customsStageIndex =
        status ===
          "Customs Clearance"
          ? getCustomsStageIndex(
              customsStage
            )
          : null;

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

          progress:
            shipmentProgress,

          customsStage:
            status ===
            "Customs Clearance"
              ? customsStage || null
              : null,

          customsStageIndex,

          city:
            String(city).trim(),

          country:
            String(country).trim(),

          lat:
            coordinates.lat,

          lng:
            coordinates.lng,

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
         UPDATE SHIPMENT
      ================================================== */

      shipment.status =
        status;

      shipment.progress =
        shipmentProgress;

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
          coordinates.lat,

        lng:
          coordinates.lng,

        updatedAt:
          new Date(),
      };

      /* ==================================================
         DELIVERED
      ================================================== */

      if (
        status === "Delivered"
      ) {
        shipment.progress =
          100;

        shipment.isDelivered =
          true;

        shipment.deliveredAt =
          new Date();
      }

      await shipment.save();

      /* ==================================================
         EMAIL NOTIFICATION
      ================================================== */

      try {
        const recipients = [
          shipment.sender
            ?.email,

          shipment.receiver
            ?.email,
        ].filter(Boolean);

        if (
          recipients.length > 0
        ) {
          const customsText =
            status ===
              "Customs Clearance" &&
            customsStage
              ? `
                <p>
                  <strong>
                    Customs Stage:
                  </strong>
                  ${escapeHtml(
                    customsStage
                  )}
                </p>
              `
              : "";

          await sendEmail({
            to: recipients,

            subject:
              `Shipment Update – ${shipment.trackingNumber}`,

            html: `
              <div style="font-family:Arial,sans-serif;line-height:1.6;color:#222">

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

                ${
                  customsText
                }

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

      res.json({
        message:
          "Shipment status, progress and location updated successfully",

        shipment,

        tracking,

        progress:
          shipment.progress,

        customsStage:
          tracking.customsStage,

        customsStageIndex:
          tracking.customsStageIndex,
      });
    } catch (error) {
      console.error(
        "Update shipment error:",
        error
      );

      /*
       * Duplicate key can happen for the protected
       * Booked / Picked Up / Delivered events.
       *
       * Customs Clearance is intentionally NOT
       * protected by the unique index.
       */

      if (
        error.code === 11000
      ) {
        return res.status(400).json({
          message:
            "This protected shipment status has already been recorded.",
        });
      }

      /*
       * Tracking model delivery lock.
       */

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

      res.status(500).json({
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
      const { id } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(id)
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

      await Tracking.deleteMany({
        shipment:
          shipment._id,
      });

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