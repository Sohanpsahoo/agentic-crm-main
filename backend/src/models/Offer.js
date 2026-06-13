const mongoose = require("mongoose");

const codeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    used: { type: Boolean, default: false },
    used_at: { type: Date },
  },
  { _id: false }
);

const offerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    type: {
      type: String,
      enum: ["percentage", "fixed", "free_product", "points_multiplier"],
      required: true,
    },
    value: { type: Number, required: true, min: 0 },
    code_prefix: { type: String, trim: true, default: "OFFER" },
    auto_generate_codes: { type: Boolean, default: true },
    codes: [codeSchema],
    targeting: {
      segment_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: "Segment" }],
      min_ltv: { type: Number, default: 0 },
      min_orders: { type: Number, default: 0 },
      tags: [String],
      channels: [String],
    },
    budget: {
      total_budget: { type: Number, default: 0 },
      spent: { type: Number, default: 0 },
      max_uses: { type: Number, default: 0 },
      uses_per_customer: { type: Number, default: 1 },
    },
    validity: {
      start: { type: Date, default: Date.now },
      end: { type: Date },
    },
    status: {
      type: String,
      enum: ["draft", "active", "paused", "expired"],
      default: "draft",
    },
    created_by_agent: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

offerSchema.index({ status: 1 });
offerSchema.index({ "validity.end": 1 });
offerSchema.index({ "targeting.tags": 1 });

module.exports = mongoose.model("Offer", offerSchema);
