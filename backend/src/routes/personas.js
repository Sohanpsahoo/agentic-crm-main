const express = require("express");
const router = express.Router();
const CustomerPersona = require("../models/CustomerPersona");
const Customer = require("../models/Customer");
const Order = require("../models/Order");

function computeRfmScore(customer, orderCount, totalSpent) {
  const now = Date.now();
  const daysSince = customer.last_purchase_at
    ? (now - new Date(customer.last_purchase_at).getTime()) / 86400000
    : 999;

  const R = daysSince <= 7 ? 5 : daysSince <= 30 ? 4 : daysSince <= 60 ? 3 : daysSince <= 90 ? 2 : 1;
  const F = orderCount >= 10 ? 5 : orderCount >= 6 ? 4 : orderCount >= 3 ? 3 : orderCount >= 2 ? 2 : 1;
  const M = totalSpent >= 20000 ? 5 : totalSpent >= 10000 ? 4 : totalSpent >= 5000 ? 3 : totalSpent >= 1000 ? 2 : 1;
  const score = R + F + M;

  let segment = "Potential";
  if (R >= 4 && F >= 4 && M >= 4) segment = "Champions";
  else if (F >= 3 && M >= 3) segment = "Loyal";
  else if (R <= 2 && F >= 3) segment = "At Risk";
  else if (R === 1 && F >= 4) segment = "Cannot Lose";
  else if (R === 1 && F <= 2) segment = "Lost";
  else if (R >= 4 && F <= 1) segment = "New";

  return { R, F, M, score, segment };
}

const PERSONA_LABELS = {
  Champions: "Fashion-Forward Loyalist",
  Loyal: "Consistent Buyer",
  "At Risk": "Fading Shopper",
  "Cannot Lose": "High-Value Lapsing",
  Lost: "Dormant Buyer",
  New: "Fresh Starter",
  Potential: "Emerging Customer",
};

const ACTION_MAP = {
  Champions:      { action: "upsell",    urgency: "low",    message_hint: "Exclusive early access to new collection" },
  Loyal:          { action: "retain",    urgency: "low",    message_hint: "Loyalty reward — double points this weekend" },
  "At Risk":      { action: "re-engage", urgency: "high",   message_hint: "We miss you — 20% off just for you" },
  "Cannot Lose":  { action: "winback",   urgency: "high",   message_hint: "Urgent: exclusive offer expires in 48h" },
  Lost:           { action: "winback",   urgency: "medium", message_hint: "Come back — here's what's new" },
  New:            { action: "nurture",   urgency: "medium", message_hint: "Welcome — here's your first-purchase offer" },
  Potential:      { action: "nurture",   urgency: "low",    message_hint: "Curated picks based on your style" },
};

const HOURS = [9, 11, 14, 17, 19, 20];
const CHANNELS = ["whatsapp", "email", "sms"];

// GET /api/personas — paginated list
router.get("/", async (req, res) => {
  try {
    const { segment, page = 1, limit = 20 } = req.query;
    const filter = segment ? { "rfm.segment": segment } : {};
    const [personas, total] = await Promise.all([
      CustomerPersona.find(filter)
        .sort({ "predicted.propensity_score": -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate("customer_id", "name email ltv total_orders loyalty_tier"),
      CustomerPersona.countDocuments(filter),
    ]);
    res.json({ personas, total, page: Number(page) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/personas/ai-decisions — top customers ranked by propensity for AI Decisioning page
router.get("/ai-decisions", async (req, res) => {
  try {
    const { limit = 50, action } = req.query;
    const filter = action ? { "recommended_action.action": action } : {};
    const personas = await CustomerPersona.find(filter)
      .sort({ "predicted.propensity_score": -1 })
      .limit(Number(limit))
      .populate("customer_id", "name email ltv total_orders loyalty_tier last_purchase_at");
    res.json(personas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/personas/stats — aggregate stats for AI model cards
router.get("/stats", async (req, res) => {
  try {
    const [segmentDist, avgScores, actionDist] = await Promise.all([
      CustomerPersona.aggregate([
        { $group: { _id: "$rfm.segment", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      CustomerPersona.aggregate([
        {
          $group: {
            _id: null,
            avg_propensity:    { $avg: "$predicted.propensity_score" },
            avg_churn:         { $avg: "$predicted.churn_probability" },
            avg_next_order:    { $avg: "$predicted.next_order_probability" },
            avg_winback:       { $avg: "$predicted.winback_probability" },
            high_propensity:   { $sum: { $cond: [{ $gte: ["$predicted.propensity_score", 70] }, 1, 0] } },
            high_churn:        { $sum: { $cond: [{ $gte: ["$predicted.churn_probability", 0.6] }, 1, 0] } },
            winback_candidates: { $sum: { $cond: [{ $gte: ["$predicted.winback_probability", 0.5] }, 1, 0] } },
          },
        },
      ]),
      CustomerPersona.aggregate([
        { $group: { _id: "$recommended_action.action", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);
    res.json({ segmentDist, scores: avgScores[0] || {}, actionDist });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/personas/:customer_id
router.get("/:customer_id", async (req, res) => {
  try {
    const persona = await CustomerPersona.findOne({ customer_id: req.params.customer_id });
    if (!persona) return res.status(404).json({ error: "Persona not found" });
    res.json(persona);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/personas/compute — batch recompute all personas
router.post("/compute", async (req, res) => {
  try {
    const customers = await Customer.find({}).lean();
    const orders = await Order.find({}).lean();

    const ordersByCustomer = {};
    for (const o of orders) {
      const id = o.customer_id.toString();
      if (!ordersByCustomer[id]) ordersByCustomer[id] = { count: 0, total: 0 };
      ordersByCustomer[id].count++;
      ordersByCustomer[id].total += o.total || 0;
    }

    let updated = 0;
    for (const customer of customers) {
      const cid = customer._id.toString();
      const { count: orderCount = 0, total: totalSpent = 0 } = ordersByCustomer[cid] || {};
      const { R, F, M, score, segment } = computeRfmScore(customer, orderCount, totalSpent);

      const churnProb = Math.max(0, Math.min(1, 1 - (R + F) / 10 + Math.random() * 0.1));
      const nextOrderProb = Math.max(0, Math.min(1, (R * 0.4 + F * 0.4 + M * 0.2) / 5));
      const winbackProb = R <= 2 && F >= 2 ? Math.min(1, (F * 0.5 + M * 0.3) / 5 + 0.2) : 0.1;
      const offerSensitivity = Math.max(0, Math.min(1, 0.3 + (5 - R) * 0.1 + Math.random() * 0.2));
      const propensityScore = Math.round(
        nextOrderProb * 40 + (1 - churnProb) * 30 + offerSensitivity * 20 + (score / 15) * 10
      );

      const bestHour = HOURS[Math.floor(Math.random() * HOURS.length)];
      const bestChannel = CHANNELS[Math.floor(customer._id.toString().charCodeAt(0) % 3)];
      const actionConfig = ACTION_MAP[segment] || ACTION_MAP["Potential"];
      const hourStr = bestHour >= 12 ? `${bestHour > 12 ? bestHour - 12 : bestHour} PM` : `${bestHour} AM`;

      const whatsappAff = bestChannel === "whatsapp" ? 0.7 + Math.random() * 0.3 : 0.3 + Math.random() * 0.3;
      const emailAff = bestChannel === "email" ? 0.7 + Math.random() * 0.3 : 0.25 + Math.random() * 0.3;
      const smsAff = bestChannel === "sms" ? 0.6 + Math.random() * 0.3 : 0.15 + Math.random() * 0.2;

      await CustomerPersona.findOneAndUpdate(
        { customer_id: customer._id },
        {
          customer_id: customer._id,
          rfm: { recency_score: R, frequency_score: F, monetary_score: M, rfm_score: score, segment },
          engagement: {
            best_channel: bestChannel,
            best_send_hour: bestHour,
            avg_open_rate: Math.min(1, 0.2 + Math.random() * 0.6),
            avg_click_rate: Math.min(1, 0.05 + Math.random() * 0.3),
          },
          predicted: {
            next_category: (customer.top_categories || [])[0] || "Fashion",
            next_purchase_days: Math.round(14 + (1 - nextOrderProb) * 60),
            clv_6m: Math.round(totalSpent * 0.8 + nextOrderProb * 5000),
            churn_probability: parseFloat(churnProb.toFixed(2)),
            offer_sensitivity: parseFloat(offerSensitivity.toFixed(2)),
            next_order_probability: parseFloat(nextOrderProb.toFixed(2)),
            winback_probability: parseFloat(winbackProb.toFixed(2)),
            propensity_score: propensityScore,
          },
          channel_affinity: {
            whatsapp: parseFloat(whatsappAff.toFixed(2)),
            email: parseFloat(emailAff.toFixed(2)),
            sms: parseFloat(smsAff.toFixed(2)),
          },
          recommended_action: {
            action: actionConfig.action,
            message_hint: actionConfig.message_hint,
            best_send_at: `Today ${hourStr}`,
            urgency: actionConfig.urgency,
          },
          persona_label: PERSONA_LABELS[segment] || "Emerging Customer",
          last_computed: new Date(),
        },
        { upsert: true, new: true }
      );
      updated++;
    }

    res.json({ success: true, updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
