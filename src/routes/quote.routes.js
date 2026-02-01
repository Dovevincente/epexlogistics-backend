import express from "express";
import { protect, adminOnly } from "../middleware/auth.middleware.js";
import {
  createQuote,
  getAllQuotes,
  getMyQuotes,

  priceQuote,             // admin sets price
  rejectQuote,            // admin rejects quote

  acceptQuote,            // customer accepts price
  declineQuote,           // customer declines price

  submitShipmentDetails,  // customer submits shipment details
  convertToShipment,      // admin creates shipment
} from "../controllers/quote.controller.js";

const router = express.Router();

/* ======================================================
   PUBLIC (GUEST + AUTHENTICATED USER)
====================================================== */
router.post("/", createQuote);

/* ======================================================
   LOGGED-IN CUSTOMER
====================================================== */
router.get("/my", protect, getMyQuotes);

// customer decision
router.post("/:id/accept", protect, acceptQuote);
router.post("/:id/decline", protect, declineQuote);

// customer submits shipment details AFTER accepting
router.post("/:id/shipment-details", protect, submitShipmentDetails);

/* ======================================================
   ADMIN
====================================================== */
router.get("/", protect, adminOnly, getAllQuotes);
router.patch("/:id/price", protect, adminOnly, priceQuote);
router.patch("/:id/reject", protect, adminOnly, rejectQuote);

// admin creates shipment AFTER customer submitted details
router.post("/:id/convert", protect, adminOnly, convertToShipment);

export default router;
