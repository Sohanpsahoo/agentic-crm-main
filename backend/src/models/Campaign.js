const mongoose = require("mongoose");

const copyVariantSchema = new mongoose.Schema(
  {
    variant_id: { type: String, required: true },
    headline: String,
    body: { type: String, required: true },
    cta: String,
    is_winner: { type: Boolean, default: false },
  },
  { _id: false }
);

const campaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    goal: {
      type: String,
      enum: ["re-engage", "upsell", "announce", "winback", "loyalty", "welcome"],
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "scheduled", "running", "paused", "completed", "failed"],
      default: "draft",
    },
    segment_id: { type: mongoose.Schema.Types.ObjectId, ref: "Segment" },
    channel: {
      type: String,
      enum: ["whatsapp", "sms", "email", "rcs", "multi"],
      required: true,
    },
    copy_variants: [copyVariantSchema],
    schedule: {
      send_at: Date,
      timezone: { type: String, default: "Asia/Kolkata" },
      send_window: {
        start_hour: { type: Number, default: 9 },
        end_hour: { type: Number, default: 21 },
      },
    },
    created_by_agent: { type: Boolean, default: false },
    agent_session_id: { type: String },
    metrics_summary: {
      sent: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      opened: { type: Number, default: 0 },
      clicked: { type: Number, default: 0 },
      converted: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

campaignSchema.index({ status: 1, created_at: -1 });
campaignSchema.index({ segment_id: 1 });
campaignSchema.index({ goal: 1, channel: 1 });

module.exports = mongoose.model("Campaign", campaignSchema);
