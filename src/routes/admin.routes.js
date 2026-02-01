import express from "express";
import { protect, adminOnly } from "../middleware/auth.middleware.js";

import {
  getAdminStats,
  getAllShipments,
  getAllQuotes,
  replyToContactMessage,
} from "../controllers/admin.controller.js";

import ContactMessage from "../models/ContactMessage.js";

const router = express.Router();

/* ======================================================
   ADMIN DASHBOARD STATS
====================================================== */
router.get(
  "/dashboard",
  protect,
  adminOnly,
  getAdminStats
);

/* ======================================================
   GET ALL SHIPMENTS (ADMIN VIEW ONLY)
====================================================== */
router.get(
  "/shipments",
  protect,
  adminOnly,
  getAllShipments
);

/* ======================================================
   GET ALL QUOTES (ADMIN)
====================================================== */
router.get(
  "/quotes",
  protect,
  adminOnly,
  getAllQuotes
);

/* ======================================================
   ADMIN INBOX – CONTACT MESSAGES
====================================================== */

/* ✅ GET UNREAD MESSAGE COUNT (FIXES 404 ERROR) */
router.get(
  "/inbox/unread-count",
  protect,
  adminOnly,
  async (req, res) => {
    try {
      const count = await ContactMessage.countDocuments({
        isRead: false,
      });

      res.json({ count });
    } catch (error) {
      console.error("Unread count error:", error);
      res.status(500).json({
        message: "Failed to fetch unread count",
      });
    }
  }
);

/* GET ALL CONTACT MESSAGES */
router.get(
  "/inbox",
  protect,
  adminOnly,
  async (req, res) => {
    try {
      const messages = await ContactMessage.find()
        .sort({ createdAt: -1 });

      res.json(messages);
    } catch (error) {
      res.status(500).json({
        message: "Failed to load inbox",
      });
    }
  }
);

/* MARK MESSAGE AS READ */
router.patch(
  "/inbox/:id/read",
  protect,
  adminOnly,
  async (req, res) => {
    try {
      await ContactMessage.findByIdAndUpdate(
        req.params.id,
        { isRead: true }
      );

      res.json({ message: "Marked as read" });
    } catch (error) {
      res.status(500).json({
        message: "Failed to update message",
      });
    }
  }
);

/* ADMIN REPLY TO MESSAGE (EMAIL SENT) */
router.post(
  "/inbox/:id/reply",
  protect,
  adminOnly,
  replyToContactMessage
);

export default router;
