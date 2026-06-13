const mongoose = require("mongoose");

const customerMomentSchema = new mongoose.Schema(
  {
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    event_type: {
      type: String,
      enum: ["product_viewed", "cart_abandoned", "purchase_completed"],
      required: true,
    },
    metadata: {
      product_name: String,
      product_price: Number,
      cart_value: Number,
      items: [
        {
          id: String,
          name: String,
          price: Number,
          quantity: Number,
        }
      ],
    },
    action_taken: {
      engage: { type: Boolean, default: false },
      channel: { type: String },
      message: { type: String },
      incentive: { type: String },
      timestamp: { type: Date },
      status: { type: String, enum: ["pending", "processed", "failed"] }
    }
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

customerMomentSchema.index({ customer_id: 1, created_at: -1 });
customerMomentSchema.index({ event_type: 1 });

module.exports = mongoose.model("CustomerMoment", customerMomentSchema);
