const express = require("express");
const router = express.Router();
const Communication = require("../models/Communication");
const Campaign = require("../models/Campaign");

const STATUS_ORDER = ["queued", "sent", "delivered", "opened", "clicked", "converted", "failed"];

// POST /api/webhooks/channel — receives callbacks from channel service
router.post("/channel", async (req, res) => {
  try {
    const { event, channel_message_id, campaign_id, customer_id, metadata } = req.body;

    if (!channel_message_id) {
      return res.status(400).json({ error: "channel_message_id required" });
    }

    const comm = await Communication.findOne({ channel_message_id });
    if (!comm) {
      return res.status(404).json({ error: "Communication not found" });
    }

    // only advance status (never go backwards in lifecycle)
    const currentIdx = STATUS_ORDER.indexOf(comm.status);
    const newIdx = STATUS_ORDER.indexOf(event);
    if (newIdx > currentIdx) {
      comm.status = event;
    }

    // append event to log
    comm.events.push({ event, timestamp: new Date(), metadata: metadata || {} });

    // set timestamp fields
    if (event === "sent") comm.sent_at = new Date();
    if (event === "delivered") comm.delivered_at = new Date();
    if (event === "opened") comm.opened_at = new Date();
    if (event === "clicked") comm.clicked_at = new Date();
    if (event === "converted") comm.converted_at = new Date();
    if (event === "failed") comm.failed_reason = metadata?.reason || "unknown";

    await comm.save();

    // update campaign metrics_summary denormalization
    const increment = {};
    if (event === "delivered") increment["metrics_summary.delivered"] = 1;
    if (event === "opened") increment["metrics_summary.opened"] = 1;
    if (event === "clicked") increment["metrics_summary.clicked"] = 1;
    if (event === "converted") increment["metrics_summary.converted"] = 1;
    if (event === "failed") increment["metrics_summary.failed"] = 1;

    if (Object.keys(increment).length) {
      await Campaign.findByIdAndUpdate(comm.campaign_id, { $inc: increment });
    }

    // broadcast real-time update to frontend
    req.io.emit("communication:updated", {
      communication_id: comm._id,
      campaign_id: comm.campaign_id,
      customer_id: comm.customer_id,
      channel: comm.channel,
      message: comm.personalized_body,
      event,
      status: comm.status,
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
