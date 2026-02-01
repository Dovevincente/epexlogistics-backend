import express from "express";
import { sendEmail } from "../utils/email.js";

const router = express.Router();

/**
 * Test email route
 * GET /api/test/email
 */
router.get("/email", async (req, res) => {
  try {
    await sendEmail({
      to: "YOUR_EMAIL@gmail.com", // 👈 change this to your own email
      subject: "Epex Logistics – Email Test",
      html: `
        <h2>🎉 Email setup successful</h2>
        <p>This email was sent from <strong>no-reply@epexlogistics.com</strong>.</p>
      `,
    });

    res.json({ message: "Test email sent successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Email failed",
      error: error.message,
    });
  }
});

export default router;
