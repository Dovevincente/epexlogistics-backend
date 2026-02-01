import OpenAI from "openai";
import Shipment from "../models/Shipment.js";

/* ======================================================
   AI CHAT CONTROLLER (SAFE + SHIPMENT-AWARE)
====================================================== */

let openai; // lazy instance

const getOpenAI = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not loaded");
  }

  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return openai;
};

/* ======================================================
   DVX TRACKING NUMBER REGEX
   - Matches DVX123456
   - Matches DVX-123456
   - Matches dvx 123456
====================================================== */
const DVX_REGEX = /\bDVX[\s-]?\d{5,}\b/i;

/* ======================================================
   AI CHAT HANDLER
====================================================== */
export const aiChat = async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        message: "Messages array is required",
      });
    }

    const lastUserMessage =
      messages[messages.length - 1]?.content || "";

    /* ======================================================
       🔍 AUTO-DETECT TRACKING NUMBER
    ====================================================== */
    let trackingNumber = null;
    const match = lastUserMessage.match(DVX_REGEX);

    if (match) {
      // 🔑 NORMALIZE (FIXES YOUR BUG)
      trackingNumber = match[0]
        .replace(/[^A-Z0-9]/gi, "")
        .toUpperCase();

      console.log("🔎 AI detected tracking:", trackingNumber);

      const shipment = await Shipment.findOne({ trackingNumber });

      if (!shipment) {
        return res.json({
          reply: `❌ The tracking number **${trackingNumber}** is not valid.  
Please double-check and try again.`,
        });
      }

      /* ======================================================
         📦 SHIPMENT-AWARE AI RESPONSE
      ====================================================== */
      return res.json({
        reply: `
📦 **Shipment Status Update**

• **Tracking Number:** ${shipment.trackingNumber}  
• **Current Status:** ${shipment.status}  
• **Origin:** ${shipment.origin}  
• **Destination:** ${shipment.destination}  
• **Estimated Delivery:** ${shipment.estimatedDelivery}

🗺 You can view live movement and history on the Track page.

Would you like me to explain the current status or next steps?
        `,
      });
    }

    /* ======================================================
       🤖 GENERAL AI CHAT (NO TRACKING)
    ====================================================== */
    const client = getOpenAI();

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are Epex Logistics AI Assistant 🤖.

You help customers with:
- Shipment tracking explanations
- Delivery statuses
- Logistics processes
- Website guidance

Rules:
- Never invent shipment data
- If tracking is needed, ask for DVX tracking number
- Be professional, friendly, and clear
          `,
        },
        ...messages,
      ],
      temperature: 0.4,
    });

    res.json({
      reply: completion.choices[0].message.content,
    });
  } catch (error) {
    console.error("AI error:", error.message);

    res.status(500).json({
      message: "AI service unavailable",
    });
  }
};
