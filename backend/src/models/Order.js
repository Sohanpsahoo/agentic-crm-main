const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product_id: String,
    name: { type: String, required: true },
    category: String,
    quantity: { type: Number, default: 1 },
    price: { type: Number, required: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    order_number: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["placed", "shipped", "delivered", "returned", "cancelled"],
      default: "placed",
    },
    items: [orderItemSchema],
    total: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    placed_at: { type: Date, default: Date.now },
    delivered_at: { type: Date },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

orderSchema.index({ customer_id: 1, placed_at: -1 });
orderSchema.index({ placed_at: -1 });
orderSchema.index({ status: 1 });

module.exports = mongoose.model("Order", orderSchema);
