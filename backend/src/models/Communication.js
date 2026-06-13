const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    event: {
      type: String,
      enum: ["queued", "sent", "delivered", "opened", "clicked", "converted", "failed"],
    },
    timestamp: { type: Date, default: Date.now },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const communicationSchema = new mongoose.Schema(
  {
    campaign_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
    },
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    channel: {
      type: String,
      enum: ["whatsapp", "sms", "email", "rcs"],
      required: true,
    },
    variant_id: { type: String },
    personalized_body: { type: String, required: true },
    status: {
      type: String,
      enum: ["queued", "sent", "delivered", "opened", "clicked", "converted", "failed"],
      default: "queued",
    },
    channel_message_id: { type: String },
    events: [eventSchema],
    sent_at: Date,
    delivered_at: Date,
    opened_at: Date,
    clicked_at: Date,
    converted_at: Date,
    failed_reason: String,
    retry_count: { type: Number, default: 0 },
    offer_id: { type: mongoose.Schema.Types.ObjectId, ref: "Offer" },
    revenue_attributed: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

communicationSchema.index({ campaign_id: 1, status: 1 });
communicationSchema.index({ customer_id: 1, campaign_id: 1 });
communicationSchema.index({ channel_message_id: 1 });

module.exports = mongoose.model("Communication", communicationSchema);
