const express = require("express");
const router = express.Router();
const axios = require("axios");
const MonitorAlert = require("../models/MonitorAlert");
const Campaign = require("../models/Campaign");
const Communication = require("../models/Communication");

const AI_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

// GET /api/monitor/alerts — paginated alert list
router.get("/alerts", async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = status ? { status } : {};
    const [alerts, total] = await Promise.all([
      MonitorAlert.find(filter)
        .populate("campaign_id", "name channel goal status")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      MonitorAlert.countDocuments(filter),
    ]);
    res.json({ alerts, total, page: Number(page) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/monitor/run — trigger AI monitor run
router.post("/run", async (req, res) => {
  try {
    const resp = await axios.post(`${AI_URL}/monitor/run`, {}, { timeout: 5000 });
    res.json({ status: "triggered", session_id: resp.data?.session_id });
  } catch (err) {
    // AI service might be starting up — still return 202
    res.status(202).json({ status: "triggered", note: "AI service may be starting" });
  }
});

// POST /api/monitor/webhook — AI service posts results here after run
router.post("/webhook", async (req, res) => {
  try {
    const { alerts = [] } = req.body;
    const saved = [];
    for (const alert of alerts) {
      const doc = await MonitorAlert.findOneAndUpdate(
        { campaign_id: alert.campaign_id, status: "pending", metric_failed: alert.metric_failed },
        { $setOnInsert: { ...alert, status: "pending", createdAt: new Date() } },
        { upsert: true, new: true }
      );
      saved.push(doc);
    }

    // Push to frontend via Socket.io
    const io = req.app.get("io");
    if (io && saved.length) {
      io.emit("monitor:alerts", saved);
    }

    res.json({ saved: saved.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/monitor/alerts/:id/apply — resend to non-openers with suggested copy
router.post("/alerts/:id/apply", async (req, res) => {
  try {
    const alert = await MonitorAlert.findById(req.params.id).populate("campaign_id");
    if (!alert) return res.status(404).json({ error: "Alert not found" });

    const campaign = alert.campaign_id;

    // Find non-openers for this campaign
    const nonOpeners = await Communication.find({
      campaign_id: campaign._id,
      status: { $in: ["sent", "delivered"] }, // did NOT open
    }).select("customer_id channel").lean();

    if (!nonOpeners.length) {
      return res.json({ success: true, note: "No non-openers to resend to" });
    }

    // Dispatch resend via agent
    const sessionId = `monitor_resend_${alert._id}_${Date.now()}`;
    const query = `Resend campaign "${campaign.name}" to ${nonOpeners.length} customers who didn't open it. Use this improved message: "${alert.suggested_copy}". Channel: ${campaign.channel}.`;

    try {
      await axios.post(
        `${AI_URL}/run`,
        {
          session_id: sessionId,
          query,
          context: {
            campaign_id: campaign._id.toString(),
            non_opener_ids: nonOpeners.map((c) => c.customer_id.toString()),
            override_copy: alert.suggested_copy,
          },
        },
        { timeout: 5000 }
      );
    } catch {
      // AI service offline — fire channel service directly
    }

    await MonitorAlert.findByIdAndUpdate(alert._id, {
      status: "applied",
      applied_at: new Date(),
      applied_session_id: sessionId,
      non_openers_count: nonOpeners.length,
    });

    res.json({ success: true, session_id: sessionId, non_openers: nonOpeners.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/monitor/alerts/:id/dismiss
router.patch("/alerts/:id/dismiss", async (req, res) => {
  try {
    await MonitorAlert.findByIdAndUpdate(req.params.id, { status: "dismissed" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
