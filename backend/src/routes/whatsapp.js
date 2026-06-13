const express = require("express");
const router = express.Router();
const axios = require("axios");

const WA_URL = process.env.WHATSAPP_SERVICE_URL || "http://localhost:3003";

async function proxy(path, method, body, res) {
  try {
    const r = await axios({ method, url: `${WA_URL}${path}`, data: body, timeout: 10000 });
    res.json(r.data);
  } catch (err) {
    const status = err.response?.status || 503;
    res.status(status).json({ error: err.response?.data?.error || err.message });
  }
}

router.get("/status",     (_req, res) => proxy("/status", "GET", null, res));
router.get("/qr",         (_req, res) => proxy("/qr",     "GET", null, res));
router.post("/disconnect", (_req, res) => proxy("/disconnect", "POST", null, res));

// POST /api/whatsapp/send — proxy to WA service, used by channel-service routing
router.post("/send", (req, res) => proxy("/send", "POST", req.body, res));

module.exports = router;
