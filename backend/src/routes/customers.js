const express = require("express");
const router = express.Router();
const Customer = require("../models/Customer");
const Order = require("../models/Order");

// GET /api/customers — paginated list with filters
router.get("/", async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      tag,
      channel,
      minLtv,
      minDaysSincePurchase,
      maxDaysSincePurchase,
      search,
      ageGroup,
    } = req.query;

    const filter = {};
    if (tag) filter.tags = tag;
    if (channel) filter[`channel_preferences.${channel}`] = true;
    if (minLtv) filter.ltv = { $gte: Number(minLtv) };
    if (ageGroup) filter['demographics.age_group'] = ageGroup;
    
    if (minDaysSincePurchase || maxDaysSincePurchase) {
      filter.last_purchase_at = {};
      if (minDaysSincePurchase) {
        const cutoffMin = new Date();
        cutoffMin.setDate(cutoffMin.getDate() - Number(minDaysSincePurchase));
        filter.last_purchase_at.$lte = cutoffMin;
      }
      if (maxDaysSincePurchase) {
        const cutoffMax = new Date();
        cutoffMax.setDate(cutoffMax.getDate() - Number(maxDaysSincePurchase));
        filter.last_purchase_at.$gte = cutoffMax;
      }
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } }
      ];
    }

    const [customers, total] = await Promise.all([
      Customer.find(filter)
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Customer.countDocuments(filter),
    ]);

    res.json({ customers, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

// GET /api/customers/:id
router.get("/:id", async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id).lean();
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const orders = await Order.find({ customer_id: req.params.id })
      .sort({ placed_at: -1 })
      .limit(10)
      .lean();

    res.json({ ...customer, recent_orders: orders });
  } catch (err) {
    next(err);
  }
});

// POST /api/customers
router.post("/", async (req, res, next) => {
  try {
    const customer = await Customer.create(req.body);
    res.status(201).json(customer);
  } catch (err) {
    next(err);
  }
});

// POST /api/customers/import — bulk upsert
router.post("/import", async (req, res, next) => {
  try {
    const { customers } = req.body;
    if (!Array.isArray(customers)) {
      return res.status(400).json({ error: "customers array required" });
    }
    const ops = customers.map((c) => ({
      updateOne: {
        filter: { email: c.email },
        update: { $set: c },
        upsert: true,
      },
    }));
    const result = await Customer.bulkWrite(ops);
    res.json({ inserted: result.upsertedCount, modified: result.modifiedCount });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/customers/:id
router.patch("/:id", async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    res.json(customer);
  } catch (err) {
    next(err);
  }
});

// GET /api/customers/:id/orders
router.get("/:id/orders", async (req, res, next) => {
  try {
    const orders = await Order.find({ customer_id: req.params.id })
      .sort({ placed_at: -1 })
      .lean();
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
