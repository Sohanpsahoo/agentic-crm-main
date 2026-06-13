const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const Customer = require("../models/Customer");

// GET /api/products
router.get("/", async (req, res) => {
  try {
    const { category, in_stock, page = 1, limit = 30 } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (in_stock !== undefined) filter.in_stock = in_stock === "true";

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      Product.countDocuments(filter),
    ]);

    res.json({ products, total, page: Number(page) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products
router.post("/", async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/products/import
router.post("/import", async (req, res) => {
  try {
    const { products } = req.body;
    if (!Array.isArray(products)) return res.status(400).json({ error: "products array required" });

    const result = await Product.insertMany(products, { ordered: false });
    res.json({ inserted: result.length });
  } catch (err) {
    res.status(400).json({ error: err.message, inserted: err.result?.nInserted || 0 });
  }
});

// GET /api/products/recommend/:customer_id
router.get("/recommend/:customer_id", async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.customer_id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const topCats = customer.top_categories?.slice(0, 3) || [];
    const filter = { in_stock: true };
    if (topCats.length) filter.category = { $in: topCats };

    const recommendations = await Product.find(filter)
      .sort({ price: -1 })
      .limit(6);

    res.json({ customer_id: req.params.customer_id, recommendations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
