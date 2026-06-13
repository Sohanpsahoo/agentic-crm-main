const mongoose = require("mongoose");

const analyticsSchema = new mongoose.Schema(
  {
    campaign_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      unique: true,
    },
    computed_at: { type: Date, default: Date.now },
    funnel: {
      sent: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      delivered_rate: { type: Number, default: 0 },
      opened: { type: Number, default: 0 },
      open_rate: { type: Number, default: 0 },
      clicked: { type: Number, default: 0 },
      ctr: { type: Number, default: 0 },
      converted: { type: Number, default: 0 },
      conversion_rate: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    segment_breakdown: [
      {
        segment_name: String,
        size: Number,
        open_rate: Number,
        conversion_rate: Number,
        _id: false,
      },
    ],
    variant_performance: [
      {
        variant_id: String,
        open_rate: Number,
        ctr: Number,
        is_winner: { type: Boolean, default: false },
        _id: false,
      },
    ],
    insights_text: { type: String },
    optimization_suggestions: [{ type: String }],
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

analyticsSchema.index({ campaign_id: 1 });

module.exports = mongoose.model("Analytics", analyticsSchema);
