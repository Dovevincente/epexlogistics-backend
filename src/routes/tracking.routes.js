import express from "express";
import { protect, adminOnly } from "../middleware/auth.middleware.js";
import {
  trackShipment,
  addTrackingEvent,
} from "../controllers/tracking.controller.js";

const router = express.Router();

/* ======================================================
   PUBLIC TRACKING (CUSTOMER)
====================================================== */
router.get("/:trackingNumber", trackShipment);

/* ======================================================
   ADMIN – ADD TRACKING UPDATE
   (In Transit, On Hold, Customs Clearance, etc.)
====================================================== */
router.post(
  "/:trackingNumber",
  protect,
  adminOnly,
  addTrackingEvent
);

export default router;
