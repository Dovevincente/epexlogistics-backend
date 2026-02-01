import ContactMessage from "../models/ContactMessage.js";

/* ======================================================
   GET ALL CONTACT MESSAGES (ADMIN)
====================================================== */
export const getContactMessages = async (req, res) => {
  try {
    const messages = await ContactMessage.find()
      .sort({ createdAt: -1 });

    res.json(messages);
  } catch (error) {
    console.error("Admin inbox error:", error);
    res.status(500).json({
      message: "Failed to load messages",
    });
  }
};

/* ======================================================
   MARK MESSAGE AS READ
====================================================== */
export const markMessageRead = async (req, res) => {
  try {
    const message = await ContactMessage.findById(
      req.params.id
    );

    if (!message) {
      return res.status(404).json({
        message: "Message not found",
      });
    }

    message.isRead = true;
    await message.save();

    res.json({ message: "Marked as read" });
  } catch (error) {
    res.status(500).json({
      message: "Update failed",
    });
  }
};
