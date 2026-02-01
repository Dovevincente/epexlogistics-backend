import express from "express";
import cors from "cors";

/* ============================
   ROUTES
============================ */
import authRoutes from "./routes/auth.routes.js";
import shipmentRoutes from "./routes/shipment.routes.js";
import trackingRoutes from "./routes/tracking.routes.js";
import quoteRoutes from "./routes/quote.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import userRoutes from "./routes/user.routes.js";
import contactRoutes from "./routes/contact.routes.js";
import adminInboxRoutes from "./routes/adminInbox.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import testEmailRoutes from "./routes/testEmail.routes.js";


/* ============================
   INITIALIZE APP
============================ */
const app = express();

/* ============================
   GLOBAL MIDDLEWARE
============================ */

/**
 * ✅ FINAL CORS CONFIG (PRODUCTION SAFE)
 * - Works with Vercel + Render + localhost
 * - Fixes login/register CORS errors
 * - Handles OPTIONS preflight correctly
 * - Supports Authorization headers
 */
app.use(
  cors({
    origin: true, // dynamically allow requesting origin
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

/* ✅ Handle preflight requests */
app.options("*", cors());

/* ============================
   BODY PARSERS
============================ */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* ============================
   API ROUTES
============================ */
app.use("/api/auth", authRoutes);
app.use("/api/shipments", shipmentRoutes);
app.use("/api/tracking", trackingRoutes);
app.use("/api/quotes", quoteRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/admin/inbox", adminInboxRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/test", testEmailRoutes);


/* ============================
   HEALTH CHECK
============================ */
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    service: "Epex Logistics API",
    version: "1.0.0",
  });
});

/* ============================
   404 HANDLER
============================ */
app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
  });
});

export default app;
