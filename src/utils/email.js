import { Resend } from "resend";

let resendClient = null;

/**
 * Get or create Resend client (lazy init)
 */
function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error(
      "RESEND_API_KEY is missing. Check your .env configuration."
    );
  }

  if (!process.env.EMAIL_FROM) {
    throw new Error(
      "EMAIL_FROM is missing. Add EMAIL_FROM=no-reply@epexlogistics.com to .env"
    );
  }

  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }

  return resendClient;
}

/**
 * Send email using Epex Logistics domain
 */
export async function sendEmail({ to, subject, html }) {
  try {
    const resend = getResendClient();

    return await resend.emails.send({
      from: `Epex Logistics <${process.env.EMAIL_FROM}>`,
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error("❌ Email send failed:", error.message);
    throw error;
  }
}
