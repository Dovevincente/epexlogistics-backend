import Shipment from "../models/Shipment.js";
import Tracking from "../models/Tracking.js";

/* ======================================================
   🌍 GEOCODING
====================================================== */

/**
 * Geocode a city/country or location string using
 * OpenStreetMap Nominatim.
 *
 * Returns:
 * {
 *   lat: Number | null,
 *   lng: Number | null
 * }
 */
const geocodeLocation = async (location) => {
  try {
    if (!location || !String(location).trim()) {
      return {
        lat: null,
        lng: null,
      };
    }

    const query = encodeURIComponent(
      String(location).trim()
    );

    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?format=json` +
      `&q=${query}` +
      `&limit=1`;

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
        response.status,
        response.statusText
      );

      return {
        lat: null,
        lng: null,
      };
    }

    const data = await response.json();

    if (
      Array.isArray(data) &&
      data.length > 0 &&
      data[0].lat &&
      data[0].lon
    ) {
      return {
        lat: Number(data[0].lat),
        lng: Number(data[0].lon),
      };
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
   📍 GEOCODE CITY + COUNTRY
====================================================== */

const geocodeCityCountry = async (
  city,
  country
) => {
  if (!city || !country) {
    return {
      lat: null,
      lng: null,
    };
  }

  return geocodeLocation(
    `${city}, ${country}`
  );
};

/* ======================================================
   📊 NORMALIZE PROGRESS
====================================================== */

const normalizeProgress = (
  value,
  status
) => {
  let progress = Number(value);

  if (!Number.isFinite(progress)) {
    progress = 0;
  }

  progress = Math.round(progress);

  progress = Math.max(
    0,
    Math.min(100, progress)
  );

  /* Delivered must ALWAYS be 100% */
  if (status === "Delivered") {
    progress = 100;
  }

  return progress;
};

/* ======================================================
   🎯 CALCULATE POSITION BETWEEN TWO POINTS
====================================================== */

const calculatePosition = (
  originLat,
  originLng,
  destinationLat,
  destinationLng,
  progress
) => {
  if (
    !Number.isFinite(Number(originLat)) ||
    !Number.isFinite(Number(originLng)) ||
    !Number.isFinite(Number(destinationLat)) ||
    !Number.isFinite(Number(destinationLng))
  ) {
    return {
      lat: null,
      lng: null,
    };
  }

  const percentage =
    Number(progress) / 100;

  const lat =
    Number(originLat) +
    (Number(destinationLat) -
      Number(originLat)) *
      percentage;

  const lng =
    Number(originLng) +
    (Number(destinationLng) -
      Number(originLng)) *
      percentage;

  return {
    lat,
    lng,
  };
};

/* ======================================================
   🛃 CUSTOMS STAGES
====================================================== */

const CUSTOMS_STAGES = [
  "Prepared for Customs",
  "Checked by Customs",
  "Released by Customs",
  "Shipment Given to Our Agent",
];

/* ======================================================
   🚦 ALLOWED STATUSES
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
   🧹 CLEAN STRING
====================================================== */

const cleanString = (value) => {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value).trim();
};

/* ======================================================
   🔢 VALID COORDINATES
====================================================== */

const validateCoordinates = (
  lat,
  lng
) => {
  if (
    !Number.isFinite(Number(lat)) ||
    !Number.isFinite(Number(lng))
  ) {
    return false;
  }

  const latitude = Number(lat);
  const longitude = Number(lng);

  return (
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
};

/* ======================================================
   📦 BUILD SHIPMENT SNAPSHOT
====================================================== */

const buildShipmentSnapshot = (
  shipment
) => ({
  origin: shipment.origin || "",
  destination:
    shipment.destination || "",
  weight: shipment.weight ?? 0,
  quantity: shipment.quantity ?? 1,
  price: shipment.price ?? 0,
  deliveryRange:
    shipment.deliveryRange || "",
  estimatedDelivery:
    shipment.estimatedDelivery || null,
});

/* ======================================================
   👤 BUILD SENDER SNAPSHOT
====================================================== */

const buildSenderSnapshot = (
  shipment
) => ({
  name:
    shipment.sender?.name || "",
  email:
    shipment.sender?.email || "",
  phone:
    shipment.sender?.phone || "",
  address:
    shipment.sender?.address || "",
});

/* ======================================================
   👤 BUILD RECEIVER SNAPSHOT
====================================================== */

const buildReceiverSnapshot = (
  shipment
) => ({
  name:
    shipment.receiver?.name || "",
  email:
    shipment.receiver?.email || "",
  phone:
    shipment.receiver?.phone || "",
  address:
    shipment.receiver?.address || "",
});

/* ======================================================
   🔍 FIND SHIPMENT
====================================================== */

const findShipmentByTrackingNumber =
  async (trackingNumber) => {
    return Shipment.findOne({
      trackingNumber:
        cleanString(trackingNumber),
    }).populate(
      "customer",
      "name email"
    );
  };

/* ======================================================
   📍 GET ROUTE COORDINATES
====================================================== */

/**
 * Shipment.js stores origin and destination
 * as strings.
 *
 * We therefore geocode them when the tracking
 * endpoint needs map coordinates.
 */
const getRouteCoordinates = async (
  shipment
) => {
  const [origin, destination] =
    await Promise.all([
      geocodeLocation(
        shipment.origin
      ),

      geocodeLocation(
        shipment.destination
      ),
    ]);

  return {
    originCoordinates: origin,
    destinationCoordinates:
      destination,
  };
};

/* ======================================================
   🚚 TRACK SHIPMENT
   PUBLIC + ADMIN
====================================================== */

export const trackShipment = async (
  req,
  res
) => {
  try {
    const trackingNumber =
      cleanString(
        req.params.trackingNumber
      );

    if (!trackingNumber) {
      return res.status(400).json({
        message:
          "Tracking number is required",
      });
    }

    /* ================= FIND SHIPMENT ================= */

    const shipment =
      await findShipmentByTrackingNumber(
        trackingNumber
      );

    if (!shipment) {
      return res.status(404).json({
        message:
          "Shipment not found",
      });
    }

    /* ================= TRACKING HISTORY ================= */

    const history =
      await Tracking.find({
        trackingNumber,
      })
        .sort({
          createdAt: 1,
        })
        .lean();

    /* ================= LATEST EVENT ================= */

    const latestTracking =
      history.length > 0
        ? history[
            history.length - 1
          ]
        : null;

    /* ==================================================
       CURRENT STATUS
    ================================================== */

    const currentStatus =
      shipment.isDelivered
        ? "Delivered"
        : shipment.status ||
          latestTracking?.status ||
          "Booked";

    /* ==================================================
       CURRENT PROGRESS
    ================================================== */

    let currentProgress =
      latestTracking?.progress ??
      shipment.progress ??
      0;

    currentProgress =
      normalizeProgress(
        currentProgress,
        currentStatus
      );

    if (shipment.isDelivered) {
      currentProgress = 100;
    }

    /* ==================================================
       CURRENT LOCATION
    ================================================== */

    const currentLocation =
      latestTracking
        ? {
            city:
              latestTracking.city ||
              shipment.city ||
              "",

            country:
              latestTracking.country ||
              shipment.country ||
              "",

            lat:
              latestTracking.lat ??
              shipment.currentLocation
                ?.lat ??
              null,

            lng:
              latestTracking.lng ??
              shipment.currentLocation
                ?.lng ??
              null,

            updatedAt:
              latestTracking.createdAt ||
              shipment.currentLocation
                ?.updatedAt ||
              null,
          }
        : {
            city:
              shipment.currentLocation
                ?.city ||
              shipment.city ||
              "",

            country:
              shipment.currentLocation
                ?.country ||
              shipment.country ||
              "",

            lat:
              shipment.currentLocation
                ?.lat ??
              null,

            lng:
              shipment.currentLocation
                ?.lng ??
              null,

            updatedAt:
              shipment.currentLocation
                ?.updatedAt ??
              null,
          };

    /* ==================================================
       ROUTE COORDINATES
    ================================================== */

    const {
      originCoordinates,
      destinationCoordinates,
    } =
      await getRouteCoordinates(
        shipment
      );

    /* ==================================================
       RESPONSE
    ================================================== */

    return res.json({
      shipment: {
        trackingNumber:
          shipment.trackingNumber,

        customer:
          shipment.customer
            ? {
                name:
                  shipment.customer
                    .name,

                email:
                  shipment.customer
                    .email,
              }
            : null,

        /* ---------- SENDER ---------- */

        sender:
          buildSenderSnapshot(
            shipment
          ),

        /* ---------- RECEIVER ---------- */

        receiver:
          buildReceiverSnapshot(
            shipment
          ),

        /* ---------- ROUTE ---------- */

        origin:
          shipment.origin || "",

        destination:
          shipment.destination || "",

        originCoordinates,

        destinationCoordinates,

        /* ---------- CARGO ---------- */

        weight:
          shipment.weight ?? 0,

        quantity:
          shipment.quantity ?? 1,

        /* ---------- DELIVERY ---------- */

        deliveryRange:
          shipment.deliveryRange || "",

        estimatedDelivery:
          shipment.estimatedDelivery ||
          null,

        /* ---------- PAYMENT ---------- */

        price:
          shipment.price ?? 0,

        invoice:
          shipment.invoice || null,

        paymentMethod:
          shipment.paymentMethod ||
          null,

        invoiceStatus:
          shipment.invoiceStatus ||
          null,

        /* ---------- STATUS ---------- */

        status: currentStatus,

        isDelivered:
          shipment.isDelivered === true,

        /* ---------- PROGRESS ---------- */

        progress:
          currentProgress,

        /* ---------- LOCATION ---------- */

        currentLocation,

        /* ---------- INVOICE ---------- */

        invoiceNumber:
          shipment.invoiceNumber ||
          null,

        invoiceIssuedAt:
          shipment.invoiceIssuedAt ||
          null,

        paidAt:
          shipment.paidAt || null,

        invoicePublic:
          shipment.invoicePublic === true,

        invoiceWatermark:
          shipment.invoiceWatermark ||
          "PAID",

        /* ---------- ADMIN NOTE ---------- */

        adminNote:
          shipment.adminNote || "",

        /* ---------- METADATA ---------- */

        createdAt:
          shipment.createdAt,

        updatedAt:
          shipment.updatedAt,
      },

      /* ==================================================
         TRACKING HISTORY
      ================================================== */

      history: history.map(
        (event) => {
          const eventProgress =
            normalizeProgress(
              event.progress,
              event.status
            );

          return {
            id:
              event._id,

            _id:
              event._id,

            trackingNumber:
              event.trackingNumber,

            status:
              event.status,

            progress:
              eventProgress,

            /* ---------- CUSTOMS ---------- */

            customsStage:
              event.customsStage ||
              null,

            customsStageIndex:
              event.customsStageIndex ??
              null,

            /* ---------- LOCATION ---------- */

            city:
              event.city || "",

            country:
              event.country || "",

            lat:
              event.lat ?? null,

            lng:
              event.lng ?? null,

            coordinates: {
              lat:
                event.lat ?? null,

              lng:
                event.lng ?? null,
            },

            /* ---------- DESTINATION ---------- */

            destinationCity:
              event.destinationCity ||
              shipment.destination ||
              "",

            destinationCountry:
              event.destinationCountry ||
              "",

            /* ---------- ETA ---------- */

            estimatedArrival:
              event.estimatedArrival ||
              shipment.estimatedDelivery ||
              null,

            /* ---------- LOCATION STRING ---------- */

            location:
              event.city &&
              event.country
                ? `${event.city}, ${event.country}`
                : event.city ||
                  event.country ||
                  "",

            /* ---------- MESSAGE ---------- */

            message:
              event.message ||
              `${event.status} at ${
                event.city || ""
              }, ${
                event.country || ""
              }`,

            /* ---------- SNAPSHOTS ---------- */

            sender:
              event.sender || null,

            receiver:
              event.receiver || null,

            shipmentInfo:
              event.shipmentInfo ||
              null,

            createdAt:
              event.createdAt,

            updatedAt:
              event.updatedAt,
          };
        }
      ),
    });
  } catch (error) {
    console.error(
      "Tracking error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to track shipment",
      error:
        process.env.NODE_ENV ===
        "development"
          ? error.message
          : undefined,
    });
  }
};

/* ======================================================
   ➕ ADD TRACKING EVENT
   ADMIN ONLY
====================================================== */

export const addTrackingEvent =
  async (req, res) => {
    try {
      const {
        trackingNumber,
        status,
        progress,
        city,
        country,
        lat,
        lng,
        message,
        estimatedArrival,
        customsStage,
      } = req.body;

      /* ================= CLEAN INPUT ================= */

      const cleanTrackingNumber =
        cleanString(
          trackingNumber
        );

      const cleanStatus =
        cleanString(status);

      const cleanCity =
        cleanString(city);

      const cleanCountry =
        cleanString(country);

      const cleanMessage =
        cleanString(message);

      const cleanCustomsStage =
        cleanString(
          customsStage
        );

      /* ================= VALIDATION ================= */

      if (
        !cleanTrackingNumber ||
        !cleanStatus ||
        !cleanCity ||
        !cleanCountry
      ) {
        return res.status(400).json({
          message:
            "trackingNumber, status, city and country are required",
        });
      }

      /* ================= STATUS ================= */

      if (
        !ALLOWED_STATUSES.includes(
          cleanStatus
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid shipment status",
        });
      }

      /* ================= CUSTOMS VALIDATION ================= */

      if (
        cleanStatus ===
        "Customs Clearance"
      ) {
        if (
          cleanCustomsStage &&
          !CUSTOMS_STAGES.includes(
            cleanCustomsStage
          )
        ) {
          return res.status(400).json({
            message:
              "Invalid customs stage",
          });
        }
      }

      /*
       * Customs stage must not be attached
       * to non-customs events.
       */
      if (
        cleanStatus !==
          "Customs Clearance" &&
        cleanCustomsStage
      ) {
        return res.status(400).json({
          message:
            "Customs stage can only be used with Customs Clearance status",
        });
      }

      /* ================= FIND SHIPMENT ================= */

      const shipment =
        await findShipmentByTrackingNumber(
          cleanTrackingNumber
        );

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
        shipment.isDelivered === true
      ) {
        return res.status(400).json({
          message:
            "Shipment already delivered. Tracking updates are locked.",
        });
      }

      /* ==================================================
         PROGRESS
      ================================================== */

      let normalizedProgress;

      if (
        progress === undefined ||
        progress === null ||
        progress === ""
      ) {
        normalizedProgress =
          shipment.progress ?? 0;
      } else {
        if (
          !Number.isFinite(
            Number(progress)
          )
        ) {
          return res.status(400).json({
            message:
              "Progress must be a valid number",
          });
        }

        normalizedProgress =
          Number(progress);
      }

      normalizedProgress =
        normalizeProgress(
          normalizedProgress,
          cleanStatus
        );

      /*
       * A non-delivered shipment cannot be
       * marked as 100%.
       */
      if (
        normalizedProgress === 100 &&
        cleanStatus !== "Delivered"
      ) {
        return res.status(400).json({
          message:
            "A shipment at 100% progress must have Delivered status",
        });
      }

      /* ==================================================
         ROUTE COORDINATES
      ================================================== */

      const {
        originCoordinates,
        destinationCoordinates,
      } =
        await getRouteCoordinates(
          shipment
        );

      /* ==================================================
         CURRENT COORDINATES
      ================================================== */

      let currentLat = null;
      let currentLng = null;

      const hasLat =
        lat !== undefined &&
        lat !== null &&
        lat !== "";

      const hasLng =
        lng !== undefined &&
        lng !== null &&
        lng !== "";

      /* ==================================================
         MANUALLY PROVIDED COORDINATES
      ================================================== */

      if (hasLat || hasLng) {
        if (!hasLat || !hasLng) {
          return res.status(400).json({
            message:
              "Both latitude and longitude are required",
          });
        }

        if (
          !validateCoordinates(
            lat,
            lng
          )
        ) {
          return res.status(400).json({
            message:
              "Latitude or longitude is invalid",
          });
        }

        currentLat =
          Number(lat);

        currentLng =
          Number(lng);
      }

      /* ==================================================
         GEOCODE CURRENT CITY
      ================================================== */

      if (
        currentLat === null ||
        currentLng === null
      ) {
        const currentCoordinates =
          await geocodeCityCountry(
            cleanCity,
            cleanCountry
          );

        currentLat =
          currentCoordinates.lat;

        currentLng =
          currentCoordinates.lng;
      }

      /* ==================================================
         CALCULATE POSITION FROM PROGRESS
      ==================================================

         If current location couldn't be geocoded,
         use the route coordinates and progress.
      ================================================== */

      if (
        (currentLat === null ||
          currentLng === null) &&
        originCoordinates.lat !==
          null &&
        originCoordinates.lng !==
          null &&
        destinationCoordinates.lat !==
          null &&
        destinationCoordinates.lng !==
          null
      ) {
        const calculated =
          calculatePosition(
            originCoordinates.lat,
            originCoordinates.lng,
            destinationCoordinates.lat,
            destinationCoordinates.lng,
            normalizedProgress
          );

        currentLat =
          calculated.lat;

        currentLng =
          calculated.lng;
      }

      /* ==================================================
         DELIVERED = DESTINATION
      ================================================== */

      if (
        cleanStatus === "Delivered"
      ) {
        normalizedProgress = 100;

        if (
          destinationCoordinates.lat !==
            null &&
          destinationCoordinates.lng !==
            null
        ) {
          currentLat =
            destinationCoordinates.lat;

          currentLng =
            destinationCoordinates.lng;
        }
      }

      /* ==================================================
         CUSTOMS STAGE INDEX
      ================================================== */

      let customsStageIndex = null;

      if (
        cleanStatus ===
          "Customs Clearance" &&
        cleanCustomsStage
      ) {
        customsStageIndex =
          CUSTOMS_STAGES.indexOf(
            cleanCustomsStage
          );
      }

      /* ==================================================
         CREATE TRACKING EVENT
      ================================================== */

      const trackingData = {
        shipment:
          shipment._id,

        trackingNumber:
          cleanTrackingNumber,

        status:
          cleanStatus,

        progress:
          normalizedProgress,

        city:
          cleanCity,

        country:
          cleanCountry,

        lat:
          currentLat,

        lng:
          currentLng,

        message:
          cleanMessage ||
          `${cleanStatus} — ${cleanCity}, ${cleanCountry}`,

        /* ---------- CUSTOMS ---------- */

        customsStage:
          cleanStatus ===
          "Customs Clearance"
            ? cleanCustomsStage ||
              null
            : null,

        customsStageIndex:
          cleanStatus ===
          "Customs Clearance"
            ? customsStageIndex
            : null,

        /* ---------- ETA ---------- */

        estimatedArrival:
          estimatedArrival ||
          shipment.estimatedDelivery,

        /* ---------- SNAPSHOTS ---------- */

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
      };

      const tracking =
        await Tracking.create(
          trackingData
        );

      /* ==================================================
         UPDATE SHIPMENT
      ================================================== */

      shipment.status =
        cleanStatus;

      shipment.progress =
        normalizedProgress;

      shipment.city =
        cleanCity;

      shipment.country =
        cleanCountry;

      shipment.currentLocation = {
        city:
          cleanCity,

        country:
          cleanCountry,

        lat:
          currentLat,

        lng:
          currentLng,

        updatedAt:
          new Date(),
      };

      /* ==================================================
         DELIVERY
      ================================================== */

      if (
        cleanStatus === "Delivered"
      ) {
        shipment.isDelivered =
          true;

        shipment.progress =
          100;

        shipment.deliveredAt =
          new Date();
      }

      await shipment.save();

      /* ==================================================
         RESPONSE
      ================================================== */

      return res.status(201).json({
        message:
          "Tracking update added successfully",

        shipment: {
          id:
            shipment._id,

          trackingNumber:
            shipment.trackingNumber,

          status:
            shipment.status,

          progress:
            shipment.progress,

          isDelivered:
            shipment.isDelivered,

          city:
            shipment.city,

          country:
            shipment.country,

          currentLocation:
            shipment.currentLocation,
        },

        tracking: {
          id:
            tracking._id,

          _id:
            tracking._id,

          trackingNumber:
            tracking.trackingNumber,

          status:
            tracking.status,

          progress:
            tracking.progress,

          customsStage:
            tracking.customsStage ||
            null,

          customsStageIndex:
            tracking.customsStageIndex ??
            null,

          city:
            tracking.city,

          country:
            tracking.country,

          lat:
            tracking.lat,

          lng:
            tracking.lng,

          estimatedArrival:
            tracking.estimatedArrival,

          message:
            tracking.message,

          createdAt:
            tracking.createdAt,
        },

        progress:
          shipment.progress,
      });
    } catch (error) {
      console.error(
        "Add tracking error:",
        error
      );

      /* ================= MONGOOSE VALIDATION ================= */

      if (
        error.name ===
        "ValidationError"
      ) {
        return res.status(400).json({
          message:
            Object.values(
              error.errors
            )
              .map(
                (item) =>
                  item.message
              )
              .join(", "),
        });
      }

      /* ================= DUPLICATE ================= */

      if (
        error.code === 11000
      ) {
        return res.status(400).json({
          message:
            "This tracking event conflicts with an existing protected status.",
        });
      }

      return res.status(500).json({
        message:
          error.message ||
          "Failed to add tracking update",
      });
    }
  };

/* ======================================================
   🗑️ DELETE TRACKING EVENT
   ADMIN ONLY
====================================================== */

export const deleteTrackingEvent =
  async (req, res) => {
    try {
      const { id } =
        req.params;

      if (!id) {
        return res.status(400).json({
          message:
            "Tracking event ID is required",
        });
      }

      const tracking =
        await Tracking.findById(
          id
        );

      if (!tracking) {
        return res.status(404).json({
          message:
            "Tracking event not found",
        });
      }

      /* ==================================================
         FIND SHIPMENT
      ================================================== */

      const shipment =
        await Shipment.findById(
          tracking.shipment
        );

      /* ==================================================
         DO NOT DELETE DELIVERED EVENT
      ================================================== */

      if (
        tracking.status ===
          "Delivered" ||
        shipment?.isDelivered === true
      ) {
        return res.status(400).json({
          message:
            "Delivered shipments and their final tracking event are locked.",
        });
      }

      await tracking.deleteOne();

      /* ==================================================
         REBUILD SHIPMENT FROM LATEST EVENT
      ================================================== */

      if (shipment) {
        const latest =
          await Tracking.findOne({
            shipment:
              shipment._id,
          }).sort({
            createdAt: -1,
          });

        if (latest) {
          shipment.status =
            latest.status;

          shipment.progress =
            normalizeProgress(
              latest.progress,
              latest.status
            );

          shipment.city =
            latest.city;

          shipment.country =
            latest.country;

          shipment.currentLocation =
            {
              city:
                latest.city,

              country:
                latest.country,

              lat:
                latest.lat ??
                null,

              lng:
                latest.lng ??
                null,

              updatedAt:
                latest.createdAt ||
                new Date(),
            };
        } else {
          shipment.status =
            "Booked";

          shipment.progress = 0;

          shipment.city =
            shipment.currentLocation
              ?.city ||
            shipment.city ||
            "";

          shipment.country =
            shipment.currentLocation
              ?.country ||
            shipment.country ||
            "";

          shipment.currentLocation =
            {
              ...shipment.currentLocation,
              updatedAt:
                new Date(),
            };
        }

        await shipment.save();
      }

      return res.json({
        message:
          "Tracking event deleted successfully",
      });
    } catch (error) {
      console.error(
        "Delete tracking event error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to delete tracking event",
      });
    }
  };

/* ======================================================
   📋 GET TRACKING HISTORY
   ADMIN
====================================================== */

export const getTrackingHistory =
  async (req, res) => {
    try {
      const {
        trackingNumber,
      } = req.params;

      const cleanNumber =
        cleanString(
          trackingNumber
        );

      if (!cleanNumber) {
        return res.status(400).json({
          message:
            "Tracking number is required",
        });
      }

      const shipment =
        await Shipment.findOne({
          trackingNumber:
            cleanNumber,
        });

      if (!shipment) {
        return res.status(404).json({
          message:
            "Shipment not found",
        });
      }

      const history =
        await Tracking.find({
          trackingNumber:
            cleanNumber,
        })
          .sort({
            createdAt: 1,
          })
          .lean();

      return res.json({
        trackingNumber:
          cleanNumber,

        shipment: {
          id:
            shipment._id,

          status:
            shipment.status,

          progress:
            shipment.isDelivered
              ? 100
              : shipment.progress,

          isDelivered:
            shipment.isDelivered,

          currentLocation:
            shipment.currentLocation ||
            null,
        },

        history,
      });
    } catch (error) {
      console.error(
        "Get tracking history error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to fetch tracking history",
      });
    }
  };