import User from "../models/User.js";

/* ======================================================
   GET ALL USERS (ADMIN)
====================================================== */
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("_id name email role")
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    console.error("Fetch users error:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
};
