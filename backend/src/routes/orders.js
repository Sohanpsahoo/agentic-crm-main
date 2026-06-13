const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const Customer = require("../models/Customer");

// GET /api/orders
router.get("/", async (req, res, next) => {
  try {
    const { page = 1, limit = 20, customer_id, status } = req.query;
    const filter = {};
    if (customer_id) filter.customer_id = customer_id;
    if (status) filter.status = status;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate("customer_id", "name email")
        .sort({ placed_at: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Order.countDocuments(filter),
    ]);
    res.json({ orders, total });
  } catch (err) {
    next(err);
  }
});

// POST /api/orders — create order + update customer stats
router.post("/", async (req, res, next) => {
  try {
    const order = await Order.create(req.body);

    // denormalize stats onto customer
    const stats = await Order.aggregate([
      { $match: { customer_id: order.customer_id } },
      {
        $group: {
          _id: "$customer_id",
          total_orders: { $sum: 1 },
          ltv: { $sum: "$total" },
          avg_order_value: { $avg: "$total" },
          last_purchase_at: { $max: "$placed_at" },
          categories: { $push: "$items.category" },
        },
      },
    ]);

    if (stats.length) {
      const s = stats[0];
      const flatCategories = s.categories.flat();
      const topCategories = [...new Set(flatCategories)].slice(0, 3);
      await Customer.findByIdAndUpdate(order.customer_id, {
        total_orders: s.total_orders,
        ltv: s.ltv,
        avg_order_value: s.avg_order_value,
        last_purchase_at: s.last_purchase_at,
        top_categories: topCategories,
      });
    }

    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

// POST /api/orders/storefront - Sync storefront purchases to Mongo and trigger WhatsApp alerts
router.post("/storefront", async (req, res, next) => {
  try {
    const { name, phone, address, items, total } = req.body;
    if (!name || !phone || !address || !items || !items.length) {
      return res.status(400).json({ error: "Missing required order information" });
    }

    const cleanPhone = phone.trim();
    const tempEmail = `${cleanPhone.replace(/\+/g, "").replace(/\s/g, "")}@aethervoid.temp`;

    let customer = await Customer.findOne({ phone: cleanPhone });
    if (!customer) {
      customer = await Customer.create({
        name,
        email: tempEmail,
        phone: cleanPhone,
        location: {
          city: address.split(",")[0].trim() || "India",
          country: "India",
        },
        channel_preferences: {
          whatsapp: true,
          sms: true,
          email: true,
        }
      });
    }

    const orderNumber = `AV-${Date.now()}`;
    const orderItems = items.map(item => ({
      product_id: String(item.id),
      name: item.name,
      category: item.id === "1" ? "Rig" : (item.id === "2" ? "Keyboard" : "Mouse"),
      quantity: item.quantity,
      price: item.price
    }));

    const order = await Order.create({
      customer_id: customer._id,
      order_number: orderNumber,
      status: "placed",
      items: orderItems,
      total: total
    });

    const stats = await Order.aggregate([
      { $match: { customer_id: customer._id } },
      {
        $group: {
          _id: "$customer_id",
          total_orders: { $sum: 1 },
          ltv: { $sum: "$total" },
          avg_order_value: { $avg: "$total" },
          last_purchase_at: { $max: "$placed_at" },
          categories: { $push: "$items.category" },
        },
      },
    ]);

    if (stats.length) {
      const s = stats[0];
      const flatCategories = s.categories.flat();
      const topCategories = [...new Set(flatCategories)].slice(0, 3);
      customer = await Customer.findByIdAndUpdate(
        customer._id,
        {
          total_orders: s.total_orders,
          ltv: s.ltv,
          avg_order_value: s.avg_order_value,
          last_purchase_at: s.last_purchase_at,
          top_categories: topCategories,
        },
        { new: true }
      );
    }

    req.io.emit("customer:updated", customer);

    // Determine the product image path to send.
    const path = require("path");
    const firstItem = items[0];
    let imageFilename = "ad.jpeg";
    if (firstItem.id === "1" || firstItem.product_id === "1") imageFilename = "rig.png";
    if (firstItem.id === "2" || firstItem.product_id === "2") imageFilename = "keyboard.png";
    if (firstItem.id === "3" || firstItem.product_id === "3") imageFilename = "mouse.png";

    const imagePath = path.resolve(__dirname, `../../../shopping_module/assets/${imageFilename}`);
    const formattedTotal = total.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    const messageText = `⚡ ORDER CONFIRMED: AETHER_VOID ⚡\n\nHi ${name},\n\nYour Cash on Delivery order ${orderNumber} has been successfully secured!\n\n🛒 ITEMS:\n${items.map(i => `- ${i.name} (x${i.quantity})`).join('\n')}\n\n💰 TOTAL AMOUNT: ${formattedTotal}\n📍 SHIPPING TO: ${address}\n\nOur agent will call you shortly to verify coordinates. Thank you!`;

    const axios = require("axios");
    try {
      console.log(`[Storefront API] Dispatching WhatsApp alert to ${cleanPhone} for image: ${imagePath}`);
      await axios.post("http://localhost:3003/send", {
        to: cleanPhone,
        message: messageText,
        imagePath: imagePath
      });
      console.log("[Storefront API] WhatsApp message triggered successfully");
      req.io.emit("whatsapp:message_sent", {
        customer_id: customer._id.toString(),
        phone: cleanPhone,
        name: name,
        message: messageText,
        channel: "whatsapp"
      });
    } catch (waErr) {
      console.error("[Storefront API] Failed to trigger WhatsApp dispatch:", waErr.message);
    }

    res.status(201).json({ success: true, order });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
