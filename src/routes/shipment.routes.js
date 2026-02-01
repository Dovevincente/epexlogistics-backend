import express from "express";
import {
  getShipments,
  createShipment,
  updateShipmentStatus,
  deleteShipment,
  getShipmentInvoice,
  getPublicShipmentInvoice, // ✅ PUBLIC INVOICE
} from "../controllers/shipment.controller.js";

import { protect, adminOnly } from "../middleware/auth.middleware.js";

const router = express.Router();

/* ======================================================
   ADMIN — SHIPMENTS
====================================================== */

router.get("/", protect, adminOnly, getShipments);
router.post("/", protect, adminOnly, createShipment);
router.patch("/:id/status", protect, adminOnly, updateShipmentStatus);
router.delete("/:id", protect, adminOnly, deleteShipment);

/* ======================================================
   ADMIN / AUTH — INVOICE (JSON)
====================================================== */

router.get("/:id/invoice", protect, getShipmentInvoice);

/* ======================================================
   🌐 PUBLIC INVOICE (NO LOGIN, PRINTABLE)
   GET /invoice/:trackingNumber
====================================================== */

router.get(
  "/invoice/:trackingNumber",
  getPublicShipmentInvoice
);

export default router;
