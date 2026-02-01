import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

dotenv.config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    const existingAdmin = await User.findOne({ role: "admin" });
    if (existingAdmin) {
      console.log("Admin already exists");
      process.exit();
    }

    const hashedPassword = await bcrypt.hash("Admin@123", 10);

    const admin = await User.create({
      name: "Admin",
      email: "admin@epexlogistics.com",
      password: hashedPassword,
      role: "admin",
    });

    console.log("✅ Admin user created:", admin.email);
    process.exit();
  } catch (err) {
    console.error("❌ Seed admin error:", err.message);
    process.exit(1);
  }
};

seedAdmin();
