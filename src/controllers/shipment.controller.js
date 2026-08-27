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
      },
    });

    if (!response.ok) {
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
   🔢 INVOICE NUMBER
====================================================== */

const generateInvoiceNumber = () => {
  return `INV-${Date.now()}-${Math.floor(
    Math.random() * 1000
  )}`;
};

/* ======================================================
   💰 VAT
====================================================== */

const getVatPercentByCountry = (country) => {
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
    c === "usa"
  ) {
    return 0;
  }

  return 0;
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

    /* ================= VALIDATION ================= */

    if (
      !sender?.name ||
      !sender?.phone ||
      !sender?.address ||
      !receiver?.name ||
      !receiver?.phone ||
      !receiver?.address ||
      !origin ||
      !destination ||
      !weight ||
      !deliveryRange ||
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

    /* ================= NUMBERS ================= */

    const numericWeight =
      Number(weight);

    const numericQuantity =
      quantity
        ? Number(quantity)
        : 1;

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

    /* ================= DELIVERY DATE ================= */

    const today =
      new Date();

    const estimatedDelivery =
      new Date(today);

    const normalizedRange =
      deliveryRange
        .toLowerCase()
        .replace(/[–—]/g, "-")
        .trim();

    if (
      normalizedRange.startsWith(
        "6-10"
      )
    ) {
      estimatedDelivery.setDate(
        today.getDate() + 8
      );
    } else if (
      normalizedRange.startsWith(
        "1-3"
      )
    ) {
      estimatedDelivery.setDate(
        today.getDate() + 2
      );
    } else {
      return res.status(400).json({
        message:
          "Invalid delivery range. Use 1–3 or 6–10 business days",
      });
    }

    /* ================= VAT ================= */

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

    /* ================= IDENTIFIERS ================= */

    const trackingNumber =
      generateTracking();

    const invoiceNumber =
      generateInvoiceNumber();

    /* ================= CREATE ================= */

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

        origin,
        destination,

        city,
        country,

        currentLocation: {
          city,
          country,
          lat: null,
          lng: null,
          updatedAt: null,
        },

        weight:
          numericWeight,

        quantity:
          numericQuantity,

        deliveryRange,

        estimatedDelivery,

        price: subtotal,

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

        progress: 0,

        isDelivered:
          false,

        deliveredAt:
          null,
      });

    /* ================= GEOCODING ================= */

    const {
      lat,
      lng,
    } =
      await geocodeLocation(
        city,
        country
      );

    /* ================= UPDATE LOCATION ================= */

    shipment.currentLocation = {
      city,
      country,
      lat,
      lng,
      updatedAt:
        new Date(),
    };

    await shipment.save();

    /* ================= INITIAL TRACKING ================= */

    await Tracking.create({
      shipment:
        shipment._id,

      trackingNumber,

      status:
        "Booked",

      progress: 0,

      city,
      country,

      lat,
      lng,

      message:
        "Shipment booked. Thank you for choosing Epex Logistics",

      sender: {
        name:
          shipment.sender.name,

        email:
          shipment.sender.email,

        phone:
          shipment.sender.phone,

        address:
          shipment.sender.address,
      },

      receiver: {
        name:
          shipment.receiver.name,

        email:
          shipment.receiver.email,

        phone:
          shipment.receiver.phone,

        address:
          shipment.receiver.address,
      },

      shipmentInfo: {
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
      },
    });

    /* ================= EMAIL SENDER ================= */

    if (
      shipment.sender.email
    ) {
      try {
        await sendEmail({
          to:
            shipment.sender.email,

          subject:
            `Shipment Booked – ${trackingNumber}`,

          html: `
            <div style="font-family:Arial;line-height:1.6">

              <h2>📦 Shipment Successfully Booked</h2>

              <p>
                Hello ${shipment.sender.name},
              </p>

              <p>
                Your shipment has been created successfully.
              </p>

              <p>
                <strong>Tracking Number:</strong>
                ${trackingNumber}
              </p>

              <p>
                <strong>Route:</strong>
                ${origin} → ${destination}
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

    /* ================= RESPONSE ================= */

    res.status(201).json({
      message:
        "Shipment created successfully",

      shipment,
    });
  } catch (error) {
    console.error(
      "Create shipment error:",
      error
    );

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

      const shipment =
        await Shipment.findOne({
          trackingNumber,
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
      const shipment =
        await Shipment.findById(
          req.params.id
        );

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
      } = req.body;

      /* ================= VALIDATION ================= */

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

      const allowedStatuses = [
        "In Transit",
        "Customs Clearance",
        "On Hold",
        "Out for Delivery",
        "Delivered",
      ];

      if (
        !allowedStatuses.includes(
          status
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid shipment status",
        });
      }

      /* ================= FIND ================= */

      const shipment =
        await Shipment.findById(
          req.params.id
        );

      if (!shipment) {
        return res.status(404).json({
          message:
            "Shipment not found",
        });
      }

      /* ================= LOCK ================= */

      if (
        shipment.isDelivered
      ) {
        return res.status(400).json({
          message:
            "Shipment already delivered. Updates locked.",
        });
      }

      /* ================= PROGRESS ================= */

      let shipmentProgress =
        progress !== undefined &&
        progress !== null &&
        progress !== ""
          ? Number(progress)
          : shipment.progress ??
            0;

      if (
        !Number.isFinite(
          shipmentProgress
        )
      ) {
        return res.status(400).json({
          message:
            "Progress must be a valid number",
        });
      }

      shipmentProgress =
        Math.round(
          shipmentProgress
        );

      if (
        shipmentProgress < 0 ||
        shipmentProgress > 100
      ) {
        return res.status(400).json({
          message:
            "Progress must be between 0 and 100",
        });
      }

      /* ================= DELIVERY ================= */

      if (
        status === "Delivered"
      ) {
        shipmentProgress =
          100;
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

      /* ================= LOCATION ================= */

      let coordinates;

      if (
        lat !== undefined &&
        lng !== undefined &&
        lat !== "" &&
        lng !== ""
      ) {
        coordinates = {
          lat: Number(lat),
          lng: Number(lng),
        };

        if (
          !Number.isFinite(
            coordinates.lat
          ) ||
          !Number.isFinite(
            coordinates.lng
          )
        ) {
          return res.status(400).json({
            message:
              "Latitude and longitude must be valid numbers",
          });
        }
      } else {
        coordinates =
          await geocodeLocation(
            city,
            country
          );
      }

      /* ================= TRACKING EVENT ================= */

      const tracking =
        await Tracking.create({
          shipment:
            shipment._id,

          trackingNumber:
            shipment.trackingNumber,

          status,

          progress:
            shipmentProgress,

          city,

          country,

          lat:
            coordinates.lat,

          lng:
            coordinates.lng,

          message:
            message ||
            `${status} — ${city}, ${country}`,

          sender: {
            name:
              shipment.sender
                ?.name || "",

            email:
              shipment.sender
                ?.email || "",

            phone:
              shipment.sender
                ?.phone || "",

            address:
              shipment.sender
                ?.address || "",
          },

          receiver: {
            name:
              shipment.receiver
                ?.name || "",

            email:
              shipment.receiver
                ?.email || "",

            phone:
              shipment.receiver
                ?.phone || "",

            address:
              shipment.receiver
                ?.address || "",
          },

          shipmentInfo: {
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
          },
        });

      /* ================= UPDATE SHIPMENT ================= */

      shipment.status =
        status;

      shipment.progress =
        shipmentProgress;

      shipment.city =
        city;

      shipment.country =
        country;

      shipment.currentLocation =
        {
          city,
          country,
          lat:
            coordinates.lat,
          lng:
            coordinates.lng,
          updatedAt:
            new Date(),
        };

      /* ================= DELIVERED ================= */

      if (
        status === "Delivered"
      ) {
        shipment.isDelivered =
          true;

        shipment.deliveredAt =
          new Date();
      }

      await shipment.save();

      /* ================= EMAIL ================= */

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
          await sendEmail({
            to: recipients,

            subject:
              `Shipment Update – ${shipment.trackingNumber}`,

            html: `
              <div style="font-family:Arial;line-height:1.6">

                <h2>
                  📦 Shipment Status Updated
                </h2>

                <p>
                  <strong>
                    Tracking Number:
                  </strong>
                  ${shipment.trackingNumber}
                </p>

                <p>
                  <strong>
                    Status:
                  </strong>
                  ${status}
                </p>

                <p>
                  <strong>
                    Shipment Progress:
                  </strong>
                  ${shipmentProgress}%
                </p>

                <p>
                  <strong>
                    Current Location:
                  </strong>
                  ${city}, ${country}
                </p>

                <p>
                  ${message || status}
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

      /* ================= RESPONSE ================= */

      res.json({
        message:
          "Shipment status, progress and location updated successfully",

        shipment,

        tracking,

        progress:
          shipment.progress,
      });
    } catch (error) {
      console.error(
        "Update shipment error:",
        error
      );

      if (
        error.code === 11000
      ) {
        return res.status(400).json({
          message:
            "This system status has already been recorded for this shipment",
        });
      }

      res.status(500).json({
        message:
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
      const shipment =
        await Shipment.findById(
          req.params.id
        );

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