const express = require("express");
const router = express.Router();
const CustomerMoment = require("../models/CustomerMoment");
const Customer = require("../models/Customer");
const axios = require("axios");

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || "http://localhost:3003";

// GET /api/moments - Get list of recent customer moments
router.get("/", async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;
    const moments = await CustomerMoment.find({})
      .sort({ created_at: -1 })
      .limit(Number(limit))
      .populate("customer_id", "name phone email ltv");
    res.json(moments);
  } catch (err) {
    next(err);
  }
});

// POST /api/moments/event - Log a customer clickstream moment and trigger real-time AI decisioning
router.post("/event", async (req, res, next) => {
  try {
    const { name, phone, event_type, metadata } = req.body;
    if (!phone || !event_type) {
      return res.status(400).json({ error: "phone and event_type are required" });
    }

    const cleanPhone = phone.trim();
    const displayName = name ? name.trim() : "Aether Shopper";
    const tempEmail = `${cleanPhone.replace(/\+/g, "").replace(/\s/g, "")}@aethervoid.temp`;

    // 1. Find or create Customer
    let customer = await Customer.findOne({ phone: cleanPhone });
    if (!customer) {
      customer = await Customer.create({
        name: displayName,
        email: tempEmail,
        phone: cleanPhone,
        channel_preferences: { whatsapp: true, sms: true, email: true }
      });
    }

    // 2. Save Moment
    const moment = await CustomerMoment.create({
      customer_id: customer._id,
      event_type,
      metadata
    });

    // 3. AI Agent Real-Time Decisioning Cycle
    // We run AI decision-making for cart abandonment or product interest
    if (event_type === "cart_abandoned") {
      try {
        console.log(`[Moments API] Triggering AI Decisioning for customer: ${cleanPhone} on event: ${event_type}`);
        
        const aiResponse = await axios.post(`${AI_SERVICE_URL}/agent/decision`, {
          customer: {
            name: customer.name,
            phone: customer.phone,
            ltv: customer.ltv || 0,
            total_orders: customer.total_orders || 0,
          },
          moment: event_type,
          metadata: metadata || {},
          goals: { priority: "Maximize Conversion", target: "Recover abandoned carts" },
          guardrails: { max_discount_pct: 15, max_messages_per_week: 1 }
        });

        const decision = aiResponse.data;
        console.log("[Moments API] AI Agent returned decision:", decision);

        if (decision && decision.engage) {
          // Send message using whatsapp-service
          const messageText = decision.message;
          
          // Determine product image path if present
          let imagePath = null;
          if (metadata && metadata.items && metadata.items.length) {
            const firstItem = metadata.items[0];
            let imageFilename = "ad.jpeg";
            if (firstItem.id === "1") imageFilename = "rig.png";
            if (firstItem.id === "2") imageFilename = "keyboard.png";
            if (firstItem.id === "3") imageFilename = "mouse.png";
            
            const path = require("path");
            imagePath = path.resolve(__dirname, `../../../shopping_module/assets/${imageFilename}`);
          }

          console.log(`[Moments API] Sending real-time message to ${cleanPhone} via channel: ${decision.channel}`);
          
          await axios.post(`${WHATSAPP_SERVICE_URL}/send`, {
            to: cleanPhone,
            message: messageText,
            imagePath: imagePath
          });

          // Emit WebSocket event to Simulation Center
          req.io.emit("device:message_added", {
            customer_id: customer._id.toString(),
            channel: decision.channel || "whatsapp",
            sender: "AETHER_VOID AI Winback",
            message: messageText,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          });

          // Update action taken state in database
          moment.action_taken = {
            engage: true,
            channel: decision.channel || "whatsapp",
            message: messageText,
            incentive: decision.incentive || "none",
            timestamp: new Date(),
            status: "processed"
          };
          await moment.save();
        } else {
          // Agent decided not to engage
          moment.action_taken = {
            engage: false,
            timestamp: new Date(),
            status: "processed"
          };
          await moment.save();
        }
      } catch (err) {
        console.error("[Moments API] Error in AI Decisioning flow:", err.message);
        moment.action_taken = { status: "failed" };
        await moment.save();
      }
    }

    // Emit live update to connected sockets
    const populatedMoment = await CustomerMoment.findById(moment._id).populate("customer_id", "name phone email ltv");
    req.io.emit("moment:new", populatedMoment);

    res.status(201).json({ success: true, moment: populatedMoment });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
