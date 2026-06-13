const express = require("express");
const router = express.Router();
const Campaign = require("../models/Campaign");
const Communication = require("../models/Communication");
const Analytics = require("../models/Analytics");

// GET /api/campaigns
router.get("/", async (req, res, next) => {
  try {
    const { status, goal, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (goal) filter.goal = goal;

    const [campaigns, total] = await Promise.all([
      Campaign.find(filter)
        .populate("segment_id", "name size")
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Campaign.countDocuments(filter),
    ]);
    res.json({ campaigns, total });
  } catch (err) {
    next(err);
  }
});

// GET /api/campaigns/:id
router.get("/:id", async (req, res, next) => {
  try {
    const campaign = await Campaign.findById(req.params.id)
      .populate("segment_id", "name size criteria_nl")
      .lean();
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(campaign);
  } catch (err) {
    next(err);
  }
});

// POST /api/campaigns — manual campaign creation
router.post("/", async (req, res, next) => {
  try {
    const campaign = await Campaign.create(req.body);
    res.status(201).json(campaign);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/campaigns/:id/status
router.patch("/:id/status", async (req, res, next) => {
  try {
    const { status } = req.body;
    const campaign = await Campaign.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true }
    );
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    // emit real-time update
    req.io.emit("campaign:status_changed", { campaign_id: campaign._id, status });
    res.json(campaign);
  } catch (err) {
    next(err);
  }
});

// GET /api/campaigns/:id/analytics
router.get("/:id/analytics", async (req, res, next) => {
  try {
    const campaignId = require("mongoose").Types.ObjectId.createFromHexString(req.params.id);
    
    // Fetch all communications with populated customer details
    const comms = await Communication.find({ campaign_id: campaignId })
      .populate("customer_id", "name email phone")
      .lean();

    if (!comms || comms.length === 0) {
      return res.json({ funnel: {}, timing: {}, logs: [] });
    }

    let sent = 0;
    let delivered = 0;
    let opened = 0;
    let clicked = 0;
    let converted = 0;
    let failed = 0;

    let totalDeliveryTime = 0;
    let deliveredCount = 0;
    let totalOpenTime = 0;
    let openedCount = 0;

    // Time delay slots mapping
    const slots = {
      "Instant (<5m)": { opened: 0, converted: 0 },
      "Quick (5m-1h)": { opened: 0, converted: 0 },
      "Delayed (1h-4h)": { opened: 0, converted: 0 },
      "Slow (4h+)": { opened: 0, converted: 0 }
    };

    const logs = comms.map(c => {
      sent++;
      if (c.status === "delivered" || c.status === "opened" || c.status === "clicked" || c.status === "converted") delivered++;
      if (c.status === "opened" || c.status === "clicked" || c.status === "converted") opened++;
      if (c.status === "clicked" || c.status === "converted") clicked++;
      if (c.status === "converted") converted++;
      if (c.status === "failed") failed++;

      // Compute individual durations
      let deliveryDuration = null;
      let openDuration = null;

      if (c.sent_at && c.delivered_at) {
        deliveryDuration = Math.round((new Date(c.delivered_at) - new Date(c.sent_at)) / 1000);
        totalDeliveryTime += deliveryDuration;
        deliveredCount++;
      }

      if (c.delivered_at && c.opened_at) {
        openDuration = Math.round((new Date(c.opened_at) - new Date(c.delivered_at)) / 1000);
        totalOpenTime += openDuration;
        openedCount++;

        const diffMinutes = openDuration / 60;
        let slotName = "Slow (4h+)";
        if (diffMinutes < 5) slotName = "Instant (<5m)";
        else if (diffMinutes < 60) slotName = "Quick (5m-1h)";
        else if (diffMinutes < 240) slotName = "Delayed (1h-4h)";

        slots[slotName].opened++;
        if (c.status === "converted") {
          slots[slotName].converted++;
        }
      }

      return {
        communication_id: String(c._id),
        customer_name: c.customer_id?.name || "Unknown",
        customer_phone: c.customer_id?.phone || "—",
        status: c.status,
        sent_at: c.sent_at || c.created_at,
        delivered_at: c.delivered_at,
        opened_at: c.opened_at,
        converted_at: c.converted_at,
        delivery_duration_seconds: deliveryDuration,
        open_duration_seconds: openDuration
      };
    });

    const funnel = {
      sent,
      delivered,
      delivered_rate: sent ? (delivered / sent) * 100 : 0,
      opened,
      open_rate: sent ? (opened / sent) * 100 : 0,
      clicked,
      ctr: sent ? (clicked / sent) * 100 : 0,
      converted,
      conversion_rate: sent ? (converted / sent) * 100 : 0,
      failed
    };

    const timing = {
      avg_delivery_time_seconds: deliveredCount > 0 ? Math.round(totalDeliveryTime / deliveredCount) : 0,
      avg_open_time_seconds: openedCount > 0 ? Math.round(totalOpenTime / openedCount) : 0,
      open_delay_impact: Object.keys(slots).map(slot => ({
        slot,
        opened: slots[slot].opened,
        converted: slots[slot].converted,
        conversion_rate: slots[slot].opened > 0 ? parseFloat(((slots[slot].converted / slots[slot].opened) * 100).toFixed(1)) : 0
      }))
    };

    res.json({ funnel, timing, logs });
  } catch (err) {
    next(err);
  }
});

// GET /api/campaigns/:id/communications — paginated
router.get("/:id/communications", async (req, res, next) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    const filter = { campaign_id: req.params.id };
    if (status) filter.status = status;

    const [comms, total] = await Promise.all([
      Communication.find(filter)
        .populate("customer_id", "name email phone")
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Communication.countDocuments(filter),
    ]);
    res.json({ communications: comms, total });
  } catch (err) {
    next(err);
  }
});

// POST /api/campaigns/retry-dlq
router.post("/retry-dlq", async (req, res, next) => {
  try {
    const axios = require("axios");
    const CHANNEL_SERVICE_URL = process.env.CHANNEL_SERVICE_URL || "http://localhost:3002";
    const response = await axios.post(`${CHANNEL_SERVICE_URL}/dlq/retry`);
    res.json(response.data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
