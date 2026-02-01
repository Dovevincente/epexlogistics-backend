import express from "express";
import { getAllUsers } from "../controllers/user.controller.js";
import { protect, adminOnly } from "../middleware/auth.middleware.js";

const router = express.Router();

/* ======================================================
   ADMIN — USERS
====================================================== */
router.get("/", protect, adminOnly, getAllUsers);

export default router;
