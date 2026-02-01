import express from "express";
import { sendContactMessage, replyToContactMessage } from "../controllers/contact.controller.js";
import { protect, adminOnly } from "../middleware/auth.middleware.js";

const router = express.Router();

/* ======================================================
   PUBLIC — CONTACT FORM
====================================================== */
router.post("/", sendContactMessage);

/* ======================================================
   ADMIN — REPLY TO CONTACT MESSAGE
====================================================== */
/**
 * PATCH /api/contact/:messageId/reply
 * Body: { reply }
 */
router.patch(
  "/:messageId/reply",
  protect,
  adminOnly,
  replyToContactMessage
);

export default router;
