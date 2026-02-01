import dotenv from "dotenv";

/* =========================
   LOAD ENV FIRST (CRITICAL)
========================= */
dotenv.config();

import mongoose from "mongoose";
import app from "./app.js";


/* =========================
   ENV CHECK (SAFE LOGS)
========================= */
console.log("📦 MONGO_URI:", process.env.MONGO_URI ? "LOADED" : "MISSING");
console.log(
  "📧 RESEND_API_KEY:",
  process.env.RESEND_API_KEY ? "LOADED" : "MISSING"
);

if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI is missing");
  process.exit(1);
}

/* =========================
   FORCE IPV4 (CRITICAL FIX)
   Fixes querySrv ECONNREFUSED
========================= */
process.env.NODE_OPTIONS = "--dns-result-order=ipv4first";

/* =========================
   SERVER CONFIG
========================= */
const PORT = process.env.PORT || 5000;

/* =========================
   DATABASE CONNECTION
========================= */
mongoose
  .connect(process.env.MONGO_URI, {
    family: 4, // 👈 FORCE IPv4 (THIS IS THE KEY FIX)
  })
  .then(() => {
    console.log("✅ MongoDB connected");

    app.listen(PORT, () => {
      console.log(`🚀 Epex Logistics API running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });
