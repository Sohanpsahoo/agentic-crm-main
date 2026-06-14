const express = require("express");
const router = express.Router();
const Journey = require("../models/Journey");

// GET /api/journeys
router.get("/", async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const journeys = await Journey.find(filter).sort({ created_at: -1 });
    res.json(journeys);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/journeys
router.post("/", async (req, res) => {
  try {
    const journey = await Journey.create(req.body);
    res.status(201).json(journey);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/journeys/:id
router.get("/:id", async (req, res) => {
  try {
    const journey = await Journey.findById(req.params.id);
    if (!journey) return res.status(404).json({ error: "Journey not found" });
    res.json(journey);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/journeys/:id/enroll
router.post("/:id/enroll", async (req, res) => {
  try {
    const { customer_id } = req.body;
    const journey = await Journey.findByIdAndUpdate(
      req.params.id,
      { $inc: { enrolled_count: 1 } },
      { new: true }
    );
    if (!journey) return res.status(404).json({ error: "Journey not found" });
    res.json({ journey_id: journey._id, customer_id, enrolled: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/journeys/:id/steps
router.post("/:id/steps", async (req, res) => {
  try {
    const { type, config } = req.body;
    const step_id = "step_" + Date.now();
    const journey = await Journey.findByIdAndUpdate(
      req.params.id,
      { $push: { steps: { step_id, type, config } } },
      { new: true }
    );
    if (!journey) return res.status(404).json({ error: "Journey not found" });
    res.json(journey);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/journeys/:id/status
router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const journey = await Journey.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!journey) return res.status(404).json({ error: "Journey not found" });
    res.json(journey);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/journeys/:id
router.delete("/:id", async (req, res) => {
  try {
    const journey = await Journey.findByIdAndDelete(req.params.id);
    if (!journey) return res.status(404).json({ error: "Journey not found" });
    res.json({ message: "Journey deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
