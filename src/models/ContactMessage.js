import mongoose from "mongoose";

const contactMessageSchema = new mongoose.Schema(
  {
    /* ================= USER MESSAGE ================= */
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    subject: {
      type: String,
      default: "",
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    /* ================= STATUS ================= */
    isRead: {
      type: Boolean,
      default: false,
    },

    isReplied: {
      type: Boolean,
      default: false,
    },

    /* ================= ADMIN REPLIES ================= */
    replies: [
      {
        message: {
          type: String,
          required: true,
          trim: true,
        },

        repliedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },

        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    repliedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model(
  "ContactMessage",
  contactMessageSchema
);
