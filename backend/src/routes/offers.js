const express = require("express");
const router = express.Router();
const Offer = require("../models/Offer");

function generateCode(prefix, customerId) {
  const suffix = customerId
    ? customerId.toString().slice(-6).toUpperCase()
    : Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}_${suffix}`;
}

// GET /api/offers
router.get("/", async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const [offers, total] = await Promise.all([
      Offer.find(filter)
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .select("-codes"),
      Offer.countDocuments(filter),
    ]);

    res.json({ offers, total, page: Number(page) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/offers
router.post("/", async (req, res) => {
  try {
    const offer = await Offer.create(req.body);
    res.status(201).json(offer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/offers/:id
router.get("/:id", async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) return res.status(404).json({ error: "Offer not found" });
    res.json(offer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/offers/:id/generate-codes
router.post("/:id/generate-codes", async (req, res) => {
  try {
    const { customer_ids = [] } = req.body;
    const offer = await Offer.findById(req.params.id);
    if (!offer) return res.status(404).json({ error: "Offer not found" });

    const newCodes = customer_ids.map((cid) => ({
      code: generateCode(offer.code_prefix, cid),
      customer_id: cid,
      used: false,
    }));

    offer.codes.push(...newCodes);
    await offer.save();

    res.json({ generated: newCodes.length, codes: newCodes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/offers/:id/validate
router.post("/:id/validate", async (req, res) => {
  try {
    const { code, customer_id } = req.body;
    const offer = await Offer.findById(req.params.id);
    if (!offer) return res.status(404).json({ valid: false, reason: "Offer not found" });

    const entry = offer.codes.find(
      (c) => c.code === code && (!c.customer_id || c.customer_id.toString() === customer_id)
    );

    if (!entry) return res.json({ valid: false, reason: "Code not found" });
    if (entry.used) return res.json({ valid: false, reason: "Code already used" });
    if (offer.status !== "active") return res.json({ valid: false, reason: "Offer not active" });
    if (offer.validity.end && offer.validity.end < new Date())
      return res.json({ valid: false, reason: "Offer expired" });

    entry.used = true;
    entry.used_at = new Date();
    offer.budget.spent += offer.type === "percentage" ? 0 : offer.value;
    await offer.save();

    res.json({ valid: true, offer_type: offer.type, value: offer.value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/offers/:id/status
router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const offer = await Offer.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, select: "-codes" }
    );
    if (!offer) return res.status(404).json({ error: "Offer not found" });
    res.json(offer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
