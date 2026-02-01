import ContactMessage from "../models/ContactMessage.js";
import { sendEmail } from "../utils/email.js";

/* ======================================================
   PUBLIC: SEND CONTACT MESSAGE
====================================================== */
export const sendContactMessage = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        message: "Name, email, and message are required",
      });
    }

    /* ================= SAVE TO DB ================= */
    const savedMessage = await ContactMessage.create({
      name,
      email,
      subject,
      message,
    });

    /* ================= EMAIL (NON-BLOCKING) ================= */
    try {
      // 1️⃣ Notify admin
      await sendEmail({
        to: process.env.EMAIL_FROM, // admin inbox
        subject: subject || "New Contact Message – Epex Logistics",
        html: `
          <div style="font-family: Arial, sans-serif; line-height:1.6;">
            <h3 style="color:#165587;">New Contact Message</h3>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Subject:</strong> ${subject || "—"}</p>
            <hr />
            <p>${message}</p>
          </div>
        `,
      });

      // 2️⃣ Auto-reply to user
      await sendEmail({
        to: email,
        subject: "Message received – Epex Logistics",
        html: `
          <div style="font-family: Arial, sans-serif; line-height:1.6;">
            <p>Hello ${name},</p>
            <p>
              Thank you for contacting <strong>Epex Logistics</strong>.
              We have received your message and our support team
              will respond within <strong>24 hours</strong>.
            </p>
            <br />
            <p>📦 <strong>Epex Logistics</strong></p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("⚠ Contact email failed:", emailError.message);
      // Do NOT block request
    }

    res.status(201).json({
      message: "Message received successfully",
      data: savedMessage,
    });
  } catch (error) {
    console.error("Contact form error:", error);
    res.status(500).json({
      message: "Failed to send message",
    });
  }
};

/* ======================================================
   ADMIN: REPLY TO CONTACT MESSAGE
====================================================== */
export const replyToContactMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { reply } = req.body;

    if (!reply) {
      return res.status(400).json({
        message: "Reply message is required",
      });
    }

    const contact = await ContactMessage.findById(messageId);

    if (!contact) {
      return res.status(404).json({
        message: "Contact message not found",
      });
    }

    /* ================= SAVE REPLY ================= */
    contact.isRead = true;
    contact.isReplied = true;
    contact.adminReply = reply;
    contact.repliedAt = new Date();

    await contact.save();

    /* ================= EMAIL REPLY (SAFE) ================= */
    try {
      await sendEmail({
        to: contact.email,
        subject: "Reply from Epex Logistics",
        html: `
          <div style="font-family: Arial, sans-serif; line-height:1.6;">
            <p>Hello ${contact.name},</p>
            <p>${reply}</p>
            <br />
            <p>📦 <strong>Epex Logistics</strong></p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("⚠ Reply email failed:", emailError.message);
      // Do not block response
    }

    res.json({
      message: "Reply sent successfully",
      data: contact,
    });
  } catch (error) {
    console.error("Admin reply error:", error);
    res.status(500).json({
      message: "Failed to send reply",
    });
  }
};
