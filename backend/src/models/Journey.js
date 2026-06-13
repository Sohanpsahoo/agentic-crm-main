const mongoose = require("mongoose");

const stepSchema = new mongoose.Schema(
  {
    step_id: { type: String, required: true },
    type: {
      type: String,
      enum: ["message", "wait", "condition", "offer"],
      required: true,
    },
    config: {
      wait_days: Number,
      campaign_goal: String,
      channel: String,
      offer_id: { type: mongoose.Schema.Types.ObjectId, ref: "Offer" },
      condition: mongoose.Schema.Types.Mixed,
    },
    next_step_id: { type: String },
    next_step_if_false: { type: String },
  },
  { _id: false }
);

const journeySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    trigger: {
      type: {
        type: String,
        enum: [
          "signup",
          "first_purchase",
          "nth_purchase",
          "inactivity",
          "cart_abandon",
          "birthday",
          "points_milestone",
        ],
        required: true,
      },
      config: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    status: {
      type: String,
      enum: ["draft", "active", "paused"],
      default: "draft",
    },
    steps: [stepSchema],
    enrolled_count: { type: Number, default: 0 },
    completed_count: { type: Number, default: 0 },
    created_by_agent: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

journeySchema.index({ status: 1 });
journeySchema.index({ "trigger.type": 1 });

module.exports = mongoose.model("Journey", journeySchema);
