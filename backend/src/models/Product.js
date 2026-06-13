const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    sub_category: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    compare_at_price: { type: Number, min: 0 },
    brand: { type: String, trim: true },
    tags: [{ type: String, trim: true }],
    images: [{ type: String }],
    in_stock: { type: Boolean, default: true },
    attributes: {
      color: String,
      size: String,
      material: String,
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

productSchema.index({ category: 1, in_stock: 1 });
productSchema.index({ tags: 1 });
productSchema.index({ name: "text", category: "text", tags: "text" });

module.exports = mongoose.model("Product", productSchema);
