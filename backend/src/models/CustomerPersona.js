const mongoose = require("mongoose");

const CustomerPersonaSchema = new mongoose.Schema(
  {
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, unique: true },

    rfm: {
      recency_score:   { type: Number, min: 1, max: 5, default: 3 },
      frequency_score: { type: Number, min: 1, max: 5, default: 3 },
      monetary_score:  { type: Number, min: 1, max: 5, default: 3 },
      rfm_score:       { type: Number, default: 9 },
      segment: {
        type: String,
        enum: ["Champions", "Loyal", "At Risk", "Cannot Lose", "Lost", "New", "Potential"],
        default: "Potential",
      },
    },

    engagement: {
      best_channel:    { type: String, default: "email" },
      best_send_hour:  { type: Number, min: 0, max: 23, default: 10 },
      best_send_day:   { type: Number, min: 0, max: 6, default: 2 },
      avg_open_rate:   { type: Number, default: 0 },
      avg_click_rate:  { type: Number, default: 0 },
    },

    predicted: {
      next_category:          { type: String, default: "" },
      next_purchase_days:     { type: Number, default: 30 },
      clv_6m:                 { type: Number, default: 0 },
      churn_probability:      { type: Number, min: 0, max: 1, default: 0.3 },
      offer_sensitivity:      { type: Number, min: 0, max: 1, default: 0.5 },
      // AI model scores
      next_order_probability: { type: Number, min: 0, max: 1, default: 0 },
      winback_probability:    { type: Number, min: 0, max: 1, default: 0 },
      propensity_score:       { type: Number, min: 0, max: 100, default: 50 },
    },

    // Per-channel affinity scores (0-1)
    channel_affinity: {
      whatsapp: { type: Number, min: 0, max: 1, default: 0.5 },
      email:    { type: Number, min: 0, max: 1, default: 0.5 },
      sms:      { type: Number, min: 0, max: 1, default: 0.3 },
    },

    // AI recommended next action
    recommended_action: {
      action:      { type: String, default: "nurture" },
      message_hint: { type: String, default: "" },
      best_send_at: { type: String, default: "" },
      urgency:     { type: String, enum: ["high", "medium", "low"], default: "medium" },
    },

    persona_label:  { type: String, default: "" },
    interests:      [{ type: String }],
    last_computed:  { type: Date, default: Date.now },
  },
  { timestamps: true }
);

CustomerPersonaSchema.index({ "rfm.segment": 1 });
CustomerPersonaSchema.index({ "predicted.propensity_score": -1 });
CustomerPersonaSchema.index({ "predicted.churn_probability": -1 });
CustomerPersonaSchema.index({ "predicted.next_order_probability": -1 });

module.exports = mongoose.model("CustomerPersona", CustomerPersonaSchema);
