import User from "../models/User.js";
import Shipment from "../models/Shipment.js";
import Quote from "../models/Quote.js";
import Tracking from "../models/Tracking.js";
import ContactMessage from "../models/ContactMessage.js";
import { sendEmail } from "../utils/email.js";

/* ======================================================
   ADMIN DASHBOARD STATS
====================================================== */
export const getAdminStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalShipments = await Shipment.countDocuments();
    const deliveredShipments = await Shipment.countDocuments({
      status: "Delivered",
    });
    const totalQuotes = await Quote.countDocuments();

    const recentShipments = await Shipment.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("trackingNumber destination status createdAt sender receiver");

    res.json({
      stats: {
        totalUsers,
        totalShipments,
        deliveredShipments,
        totalQuotes,
      },
      recentShipments,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({
      message: "Failed to load admin dashboard",
    });
  }
};

/* ======================================================
   GET ALL SHIPMENTS (ADMIN)
====================================================== */
export const getAllShipments = async (req, res) => {
  try {
    const shipments = await Shipment.find()
      .populate("customer", "name email")
      .populate("quote")
      .sort({ createdAt: -1 });

    res.json(shipments);
  } catch (error) {
    console.error("Fetch shipments error:", error);
    res.status(500).json({
      message: "Failed to fetch shipments",
    });
  }
};

/* ======================================================
   UPDATE SHIPMENT STATUS + LOCATION + EMAIL NOTIFY
====================================================== */
export const updateShipmentStatus = async (req, res) => {
  try {
    const { status, city, message } = req.body;

    // MUST MATCH Shipment model
    const allowedStatuses = [
      "Booked",
      "Picked Up",
      "In Transit",
      "Customs Clearance",
      "On Hold",
      "Out for Delivery",
      "Delivered",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid shipment status",
      });
    }

    if (!city) {
      return res.status(400).json({
        message: "Location (city or country) is required",
      });
    }

    const shipment = await Shipment.findById(req.params.id);

    if (!shipment) {
      return res.status(404).json({
        message: "Shipment not found",
      });
    }

    if (shipment.isDelivered) {
      return res.status(400).json({
        message: "Shipment has already been delivered. Updates are locked.",
      });
    }

    shipment.status = status;

    if (status === "Delivered") {
      shipment.isDelivered = true;
      shipment.deliveredAt = new Date();
    }

    await shipment.save();

    await Tracking.create({
      shipment: shipment._id,
      trackingNumber: shipment.trackingNumber,
      status,
      city,
      message: message || status,
    });

    /* ================= EMAIL BOTH SENDER & RECEIVER ================= */

    const emailHtml = `
      <div style="font-family:Arial;line-height:1.6">
        <h2>📦 Shipment Update</h2>

        <p><strong>Tracking Number:</strong> ${shipment.trackingNumber}</p>
        <p><strong>Status:</strong> ${status}</p>
        <p><strong>Current Location:</strong> ${city}</p>
        <p>${message || status}</p>

        <hr/>

        <p>
          Track shipment:<br/>
          https://epexlogistics.com/track
        </p>

        <br/>
        <strong>Epex Logistics</strong><br/>
        support@epexlogistics.com
      </div>
    `;

    try {
      await sendEmail({
        to: [
          shipment.sender.email,
          shipment.receiver.email
        ],
        subject: `Shipment Update – ${shipment.trackingNumber}`,
        html: emailHtml,
      });
    } catch (emailErr) {
      console.error("Shipment email failed:", emailErr.message);
    }

    res.json({
      message: "Shipment updated and email notifications sent",
      shipment,
    });
  } catch (error) {
    console.error("Update shipment error:", error);
    res.status(500).json({
      message: "Failed to update shipment",
    });
  }
};

/* ======================================================
   GET ALL QUOTES (ADMIN)
====================================================== */
export const getAllQuotes = async (req, res) => {
  try {
    const quotes = await Quote.find()
      .populate("customer", "name email")
      .populate("shipment")
      .sort({ createdAt: -1 });

    res.json(quotes);
  } catch (error) {
    console.error("Fetch quotes error:", error);
    res.status(500).json({
      message: "Failed to fetch quotes",
    });
  }
};

/* ======================================================
   ADMIN REPLY TO CONTACT MESSAGE
====================================================== */
export const replyToContactMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { reply } = req.body;

    if (!reply) {
      return res.status(400).json({
        message: "Reply message is required",
      });
    }

    const message = await ContactMessage.findById(id);

    if (!message) {
      return res.status(404).json({
        message: "Contact message not found",
      });
    }

    message.isRead = true;
    message.adminReply = reply;
    message.repliedAt = new Date();
    await message.save();

    try {
      await sendEmail({
        to: message.email,
        subject: "Reply from Epex Logistics",
        html: `
          <div style="font-family: Arial;">
            <h3>Epex Logistics Support</h3>
            <p>Hello ${message.name},</p>
            <p>${reply}</p>
            <hr/>
            <strong>Epex Logistics</strong>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("Reply email failed:", emailError.message);
    }

    res.json({
      message: "Reply sent successfully",
    });
  } catch (error) {
    console.error("Admin reply error:", error);
    res.status(500).json({
      message: "Failed to send reply",
    });
  }
};
