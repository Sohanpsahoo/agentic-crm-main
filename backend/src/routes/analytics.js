const express = require("express");
const router = express.Router();
const Communication = require("../models/Communication");
const Campaign = require("../models/Campaign");
const Customer = require("../models/Customer");
const Order = require("../models/Order");

// GET /api/analytics/overview — dashboard KPIs
router.get("/overview", async (req, res, next) => {
  try {
    const [
      totalCustomers,
      totalCampaigns,
      activeCampaigns,
      recentCommunications,
    ] = await Promise.all([
      Customer.countDocuments(),
      Campaign.countDocuments(),
      Campaign.countDocuments({ status: "running" }),
      Communication.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            delivered: { $sum: { $cond: [{ $in: ["$status", ["delivered", "opened", "clicked", "converted"]] }, 1, 0] } },
            opened: { $sum: { $cond: [{ $in: ["$status", ["opened", "clicked", "converted"]] }, 1, 0] } },
            clicked: { $sum: { $cond: [{ $in: ["$status", ["clicked", "converted"]] }, 1, 0] } },
            converted: { $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] } },
          },
        },
      ]),
    ]);

    const comms = recentCommunications[0] || { total: 0, delivered: 0, opened: 0, clicked: 0, converted: 0 };
    const t = comms.total || 1;
    res.json({
      total_customers: totalCustomers,
      total_campaigns: totalCampaigns,
      active_campaigns: activeCampaigns,
      total_messages_sent: comms.total,
      total_delivered: comms.delivered,
      total_opened: comms.opened,
      total_clicked: comms.clicked,
      total_converted: comms.converted,
      delivered_rate: comms.total ? ((comms.delivered / t) * 100).toFixed(1) : 0,
      overall_open_rate: comms.total ? ((comms.opened / t) * 100).toFixed(1) : 0,
      overall_ctr: comms.total ? ((comms.clicked / t) * 100).toFixed(1) : 0,
      overall_conversion_rate: comms.total ? ((comms.converted / t) * 100).toFixed(1) : 0,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/campaigns — aggregate all campaigns performance
router.get("/campaigns", async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - Number(days));

    const data = await Communication.aggregate([
      { $match: { created_at: { $gte: since } } },
      {
        $group: {
          _id: "$campaign_id",
          sent: { $sum: 1 },
          opened: { $sum: { $cond: [{ $in: ["$status", ["opened", "clicked", "converted"]] }, 1, 0] } },
          clicked: { $sum: { $cond: [{ $in: ["$status", ["clicked", "converted"]] }, 1, 0] } },
          converted: { $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] } },
        },
      },
      {
        $lookup: {
          from: "campaigns",
          localField: "_id",
          foreignField: "_id",
          as: "campaign",
        },
      },
      { $unwind: "$campaign" },
      {
        $project: {
          campaign_name: "$campaign.name",
          goal: "$campaign.goal",
          channel: "$campaign.channel",
          sent: 1,
          open_rate: { $multiply: [{ $divide: ["$opened", "$sent"] }, 100] },
          ctr: { $multiply: [{ $divide: ["$clicked", "$sent"] }, 100] },
          conversion_rate: { $multiply: [{ $divide: ["$converted", "$sent"] }, 100] },
        },
      },
      { $sort: { sent: -1 } },
    ]);

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/channel-performance
router.get("/channel-performance", async (req, res, next) => {
  try {
    const data = await Communication.aggregate([
      {
        $group: {
          _id: "$channel",
          total: { $sum: 1 },
          opened: { $sum: { $cond: [{ $in: ["$status", ["opened", "clicked", "converted"]] }, 1, 0] } },
          clicked: { $sum: { $cond: [{ $in: ["$status", ["clicked", "converted"]] }, 1, 0] } },
          converted: { $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] } },
        },
      },
      {
        $project: {
          channel: "$_id",
          total: 1,
          open_rate: { $multiply: [{ $divide: ["$opened", "$total"] }, 100] },
          ctr: { $multiply: [{ $divide: ["$clicked", "$total"] }, 100] },
          conversion_rate: { $multiply: [{ $divide: ["$converted", "$total"] }, 100] },
        },
      },
    ]);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/roi — per-campaign revenue attributed vs estimated cost
router.get("/roi", async (req, res, next) => {
  try {
    const data = await Communication.aggregate([
      {
        $group: {
          _id: "$campaign_id",
          revenue: { $sum: "$revenue_attributed" },
          sent: { $sum: 1 },
          converted: { $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] } },
        },
      },
      {
        $lookup: {
          from: "campaigns",
          localField: "_id",
          foreignField: "_id",
          as: "campaign",
        },
      },
      { $unwind: "$campaign" },
      {
        $project: {
          campaign_name: "$campaign.name",
          channel: "$campaign.channel",
          created_at: "$campaign.created_at",
          revenue_attributed: "$revenue",
          sent: 1,
          converted: 1,
          estimated_cost: { $multiply: ["$sent", 0.5] },
          roi: {
            $cond: [
              { $gt: [{ $multiply: ["$sent", 0.5] }, 0] },
              { $divide: ["$revenue", { $multiply: ["$sent", 0.5] }] },
              0,
            ],
          },
        },
      },
      { $sort: { created_at: -1 } },
    ]);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/business-kpis — real ROI, repeat sales, VIP spend from DB
router.get("/business-kpis", async (req, res, next) => {
  try {
    const [commStats, customerStats, vipStats] = await Promise.all([
      Communication.aggregate([
        {
          $group: {
            _id: null,
            total_sent:      { $sum: 1 },
            total_converted: { $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] } },
          },
        },
      ]),
      Customer.aggregate([
        {
          $group: {
            _id: null,
            total:           { $sum: 1 },
            repeat_buyers:   { $sum: { $cond: [{ $gte: ["$total_orders", 2] }, 1, 0] } },
            avg_order_value: { $avg: "$avg_order_value" },
            avg_ltv:         { $avg: "$ltv" },
          },
        },
      ]),
      // VIP = Gold/Platinum tier OR tagged "vip"
      Customer.aggregate([
        { $match: { $or: [{ loyalty_tier: { $in: ["Gold", "Platinum"] } }, { tags: "vip" }] } },
        { $group: { _id: null, avg_ltv: { $avg: "$ltv" }, count: { $sum: 1 } } },
      ]),
    ]);

    const cs   = commStats[0]    || { total_sent: 0, total_converted: 0 };
    const cust = customerStats[0] || { total: 1, repeat_buyers: 0, avg_order_value: 1500, avg_ltv: 2000 };
    const vip  = vipStats[0]      || { avg_ltv: 0, count: 0 };

    // ROI: estimated revenue (conversions × avg order value) / cost (sent × ₹0.50)
    const avg_aov    = cust.avg_order_value || 1500;
    const est_revenue = cs.total_converted * avg_aov;
    const est_cost   = Math.max(cs.total_sent * 0.5, 1);
    const roi        = est_cost > 0 ? est_revenue / est_cost : 0;

    // Repeat sales: % customers with ≥2 orders
    const repeat_pct = cust.total > 0 ? (cust.repeat_buyers / cust.total) * 100 : 0;

    // VIP spend multiplier: vip avg LTV / overall avg LTV
    const avg_ltv_all = cust.avg_ltv || 1;
    const vip_mult    = vip.avg_ltv > 0 ? vip.avg_ltv / avg_ltv_all : 0;

    res.json({
      avg_roi:              parseFloat(roi.toFixed(1)),
      repeat_sales_pct:     parseFloat(repeat_pct.toFixed(1)),
      vip_spend_multiplier: parseFloat(vip_mult.toFixed(1)),
      est_revenue:          Math.round(est_revenue),
      est_cost:             Math.round(est_cost),
      total_converted:      cs.total_converted,
      total_sent:           cs.total_sent,
      vip_customer_count:   vip.count,
      repeat_buyer_count:   cust.repeat_buyers,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/rfm-distribution
router.get("/rfm-distribution", async (req, res) => {
  try {
    const CustomerPersona = require("../models/CustomerPersona");
    const data = await CustomerPersona.aggregate([
      { $group: { _id: "$rfm.segment", count: { $sum: 1 } } },
      { $project: { segment: "$_id", count: 1, _id: 0 } },
      { $sort: { count: -1 } },
    ]);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
