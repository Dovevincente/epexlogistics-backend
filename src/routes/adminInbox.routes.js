import express from "express";
import {
  getContactMessages,
  markMessageRead,
} from "../controllers/adminInbox.controller.js";
import { protect, adminOnly } from "../middleware/auth.middleware.js";

const router = express.Router();

/* ======================================================
   ADMIN INBOX
====================================================== */
router.get("/", protect, adminOnly, getContactMessages);
router.patch(
  "/:id/read",
  protect,
  adminOnly,
  markMessageRead
);

export default router;
