import express from "express";

import {
  getShipments,
  createShipment,
  updateShipmentStatus,
  deleteShipment,
  getShipmentInvoice,
  getPublicShipmentInvoice,
} from "../controllers/shipment.controller.js";

import {
  protect,
  adminOnly,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/* ======================================================
   ADMIN — SHIPMENTS
====================================================== */

// Get all shipments
router.get(
  "/",
  protect,
  adminOnly,
  getShipments
);

// Create shipment
router.post(
  "/",
  protect,
  adminOnly,
  createShipment
);

// Update shipment status + tracking progress
router.patch(
  "/:id/status",
  protect,
  adminOnly,
  updateShipmentStatus
);

// Delete shipment
router.delete(
  "/:id",
  protect,
  adminOnly,
  deleteShipment
);


/* ======================================================
   ADMIN / AUTH — INVOICE
====================================================== */

// Get shipment invoice
router.get(
  "/:id/invoice",
  protect,
  getShipmentInvoice
);


/* ======================================================
   🌐 PUBLIC — INVOICE
====================================================== */

// Public invoice using tracking number
// GET /shipments/invoice/:trackingNumber
router.get(
  "/invoice/:trackingNumber",
  getPublicShipmentInvoice
);


export default router;