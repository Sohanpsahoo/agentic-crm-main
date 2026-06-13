const express = require("express");
const router = express.Router();
const Segment = require("../models/Segment");
const Customer = require("../models/Customer");

// GET /api/segments
router.get("/", async (req, res, next) => {
  try {
    const segments = await Segment.find().sort({ created_at: -1 }).lean();
    res.json(segments);
  } catch (err) {
    next(err);
  }
});

// GET /api/segments/:id
router.get("/:id", async (req, res, next) => {
  try {
    const segment = await Segment.findById(req.params.id).lean();
    if (!segment) return res.status(404).json({ error: "Segment not found" });
    res.json(segment);
  } catch (err) {
    next(err);
  }
});

// GET /api/segments/:id/customers — paginated customers in segment
router.get("/:id/customers", async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const segment = await Segment.findById(req.params.id).lean();
    if (!segment) return res.status(404).json({ error: "Segment not found" });

    const skip = (page - 1) * limit;
    const ids = segment.customer_ids.slice(skip, skip + Number(limit));
    const customers = await Customer.find({ _id: { $in: ids } }).lean();
    res.json({ customers, total: segment.size });
  } catch (err) {
    next(err);
  }
});

// POST /api/segments — manual creation
router.post("/", async (req, res, next) => {
  try {
    const { name, description, criteria_nl, criteria_json } = req.body;
    let customer_ids = [];

    if (criteria_json && Array.isArray(criteria_json)) {
      const results = await Customer.aggregate(criteria_json);
      customer_ids = results.map((r) => r._id);
    }

    const segment = await Segment.create({
      name,
      description,
      criteria_nl,
      criteria_json,
      customer_ids,
      size: customer_ids.length,
      last_refreshed_at: new Date(),
    });

    res.status(201).json(segment);
  } catch (err) {
    next(err);
  }
});

// POST /api/segments/estimate — quick live audience estimation
router.post("/estimate", async (req, res, next) => {
  try {
    const { query } = req.body;
    if (!query) return res.json({ count: 0 });
    
    const c = query.toLowerCase();
    const filter = {};
    
    if (c.includes("vip") || c.includes("loyal")) filter.tags = "vip";
    if (c.includes("churned") || c.includes("inactive")) filter.tags = "churned";
    if (c.includes("whatsapp")) filter["channel_preferences.whatsapp"] = true;
    if (c.includes("email")) filter["channel_preferences.email"] = true;
    if (c.includes("sms")) filter["channel_preferences.sms"] = true;
    
    if (c.includes("high value") || c.includes("high-value") || c.includes("ltv")) {
      filter.ltv = { $gte: 10000 };
    }
    
    const count = await Customer.countDocuments(filter);
    res.json({ count });
  } catch (err) {
    next(err);
  }
});

// POST /api/segments/generate — AI NL segment generation
router.post("/generate", async (req, res, next) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: "Query is required" });

    const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
    const axios = require("axios");
    
    const response = await axios.post(`${AI_SERVICE_URL}/agent/segment`, { query });
    
    // The AI service already saved the segment via mongo_tools, so we can just return it
    // Wait for the save to reflect (or we can just query it by ID)
    const Segment = require("../models/Segment");
    if (response.data.segment_id) {
        const newSegment = await Segment.findById(response.data.segment_id).lean();
        return res.status(201).json(newSegment || response.data);
    }
    
    res.status(201).json(response.data);
  } catch (err) {
    next(err);
  }
});

// POST /api/segments/:id/refresh — re-run dynamic criteria
router.post("/:id/refresh", async (req, res, next) => {
  try {
    const segment = await Segment.findById(req.params.id);
    if (!segment) return res.status(404).json({ error: "Segment not found" });

    if (!segment.criteria_json) {
      return res.status(400).json({ error: "No criteria_json to refresh from" });
    }

    const results = await Customer.aggregate(segment.criteria_json);
    segment.customer_ids = results.map((r) => r._id);
    segment.size = segment.customer_ids.length;
    segment.last_refreshed_at = new Date();
    await segment.save();

    res.json({ size: segment.size, refreshed_at: segment.last_refreshed_at });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/segments/:id
router.delete("/:id", async (req, res, next) => {
  try {
    await Segment.findByIdAndDelete(req.params.id);
    res.json({ message: "Segment deleted" });
  } catch (err) {
    next(err);
  }
});

// POST /api/segments/:id/generate-persona — AI Persona Generation
router.post("/:id/generate-persona", async (req, res, next) => {
  try {
    const segment = await Segment.findById(req.params.id);
    if (!segment) return res.status(404).json({ error: "Segment not found" });

    // Fetch sample customers (max 20) to send to AI
    const customers = await Customer.find({ _id: { $in: segment.customer_ids } })
      .limit(20)
      .lean();
      
    const sampleData = customers.map(c => ({
      name: c.name,
      location: c.city,
      tags: c.tags,
      ltv: c.ltv,
      total_orders: c.total_orders,
      categories: c.top_categories,
    }));

    const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
    const axios = require("axios");
    
    const response = await axios.post(`${AI_SERVICE_URL}/agent/segment-persona`, {
      segment_id: req.params.id,
      sample_customers: sampleData
    });
    
    segment.persona_card = response.data;
    await segment.save();

    res.json(segment);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
