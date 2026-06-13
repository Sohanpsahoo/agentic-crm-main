const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    external_id: { type: String, unique: true, sparse: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String },
    channel_preferences: {
      whatsapp: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      rcs: { type: Boolean, default: false },
    },
    location: {
      city: String,
      country: { type: String, default: "India" },
      timezone: { type: String, default: "Asia/Kolkata" },
    },
    demographics: {
      age_group: {
        type: String,
        enum: ["18-24", "25-34", "35-44", "45-54", "55+"],
      },
      gender: { type: String, enum: ["male", "female", "other"] },
    },
    tags: [{ type: String }],
    ltv: { type: Number, default: 0 },
    last_purchase_at: { type: Date },
    total_orders: { type: Number, default: 0 },
    avg_order_value: { type: Number, default: 0 },
    top_categories: [{ type: String }],
    churn_score: { type: Number, default: 0, min: 0, max: 1 },
    predicted_next_category: { type: String },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

customerSchema.index({ last_purchase_at: 1, tags: 1, ltv: 1 });
customerSchema.index({ "channel_preferences.whatsapp": 1 });
customerSchema.index({ email: 1 });
customerSchema.index({ churn_score: -1 });

module.exports = mongoose.model("Customer", customerSchema);
