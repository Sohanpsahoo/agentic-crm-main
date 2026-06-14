const express = require("express");
const router = express.Router();
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const AgentLog = require("../models/AgentLog");
const Campaign = require("../models/Campaign");
const Communication = require("../models/Communication");
const Customer = require("../models/Customer");

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

// POST /api/agent/start — initialize agent session and emit started event
router.post("/start", async (req, res, next) => {
  try {
    const { session_id, query } = req.body;
    if (!session_id || !query) {
      return res.status(400).json({ error: "session_id and query are required" });
    }
    await AgentLog.create({
      session_id,
      agent_name: "supervisor",
      step: "init",
      input_summary: query.slice(0, 200),
    });
    req.io.emit("agent:started", { session_id, query });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/agent/task — dispatch NL query to AI service
router.post("/task", async (req, res, next) => {
  try {
    const { query, context } = req.body;
    if (!query) return res.status(400).json({ error: "query is required" });

    const session_id = uuidv4();

    // log the start
    await AgentLog.create({
      session_id,
      agent_name: "supervisor",
      step: "init",
      input_summary: query.slice(0, 200),
    });

    // emit to connected clients that agent started
    req.io.emit("agent:started", { session_id, query });

    // fire-and-forget to AI service; AI service will call back via WebSocket
    axios
      .post(`${AI_SERVICE_URL}/run`, {
        session_id,
        query,
        context: context || {},
        ws_callback: `http://localhost:${process.env.PORT || 3001}`,
      })
      .catch((err) => {
        console.error("AI service error:", err.message);
        req.io.emit("agent:error", { session_id, error: err.message });
      });

    res.status(202).json({ session_id, status: "started" });
  } catch (err) {
    next(err);
  }
});

// GET /api/agent/task/:session_id — get all logs for a session
router.get("/task/:session_id", async (req, res, next) => {
  try {
    const logs = await AgentLog.find({ session_id: req.params.session_id })
      .sort({ timestamp: 1 })
      .lean();
    res.json({ session_id: req.params.session_id, logs });
  } catch (err) {
    next(err);
  }
});

// POST /api/agent/task/:session_id/resume — resume after human approval
router.post("/task/:session_id/resume", async (req, res, next) => {
  try {
    const { approved } = req.body;
    await axios.post(`${AI_SERVICE_URL}/run/${req.params.session_id}/resume`, {
      approved,
    });
    res.json({ status: "resumed" });
  } catch (err) {
    next(err);
  }
});

// POST /api/agent/progress — called by AI service to relay progress (internal)
router.post("/progress", async (req, res) => {
  const { session_id, step, agent, message, data } = req.body;
  req.io.emit("agent:progress", { session_id, step, agent, message, data });

  // persist to agent log
  await AgentLog.create({
    session_id,
    agent_name: agent || "unknown",
    step,
    output_summary: message,
    tools_called: data?.tools_called || [],
    tokens_used: data?.tokens_used || 0,
    duration_ms: data?.duration_ms || 0,
  }).catch(console.error);

  res.status(200).json({ ok: true });
});

// POST /api/agent/completed — called by AI service when graph finishes
router.post("/completed", async (req, res) => {
  const { session_id, result } = req.body;
  req.io.emit("agent:completed", { session_id, result });
  res.status(200).json({ ok: true });
});

// GET /api/agent/stats — dashboard KPIs for agent panel
const KNOWN_AGENTS = [
  { id: "supervisor",        label: "Supervisor",          role: "Orchestrates the full pipeline" },
  { id: "segmentation",     label: "Segmentation",        role: "Builds smart customer segments" },
  { id: "campaign_creation",label: "Campaign Creator",    role: "Designs campaign plans" },
  { id: "personalization",  label: "Personalization",     role: "Crafts personalised messages" },
  { id: "channel_selection",label: "Channel Selector",    role: "Picks best delivery channel" },
  { id: "execution",        label: "Execution",           role: "Dispatches messages at scale" },
  { id: "analytics",        label: "Analytics",           role: "Measures campaign outcomes" },
  { id: "optimization",     label: "Optimization",        role: "Suggests performance improvements" },
  { id: "journey_builder",  label: "Journey Builder",     role: "Builds automated journeys" },
  { id: "human_approval",   label: "Human-in-the-Loop",   role: "Awaits operator approval" },
];

router.get("/stats", async (req, res, next) => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Sessions that had activity in the last 5 min = "live"
    const activeSessions = await AgentLog.distinct("session_id", {
      timestamp: { $gte: fiveMinutesAgo },
    });

    // Which agent names appeared in active sessions
    const activeAgentNames = await AgentLog.distinct("agent_name", {
      session_id: { $in: activeSessions },
    });
    const activeSet = new Set(activeAgentNames);

    // All-time unique agents that have ever run
    const everUsedAgents = await AgentLog.distinct("agent_name");
    const everUsedSet = new Set(everUsedAgents);

    // Total sessions ever
    const totalSessions = await AgentLog.distinct("session_id");

    // Per-agent last-seen
    const lastSeen = await AgentLog.aggregate([
      { $group: { _id: "$agent_name", lastRun: { $max: "$timestamp" }, runs: { $sum: 1 } } },
    ]);
    const lastSeenMap = {};
    lastSeen.forEach((a) => { lastSeenMap[a._id] = { lastRun: a.lastRun, runs: a.runs }; });

    const agents = KNOWN_AGENTS.map((a) => ({
      ...a,
      status: activeSet.has(a.id) ? "live" : everUsedSet.has(a.id) ? "idle" : "ready",
      runs: lastSeenMap[a.id]?.runs || 0,
      lastRun: lastSeenMap[a.id]?.lastRun || null,
    }));

    res.json({
      total_agents: KNOWN_AGENTS.length,
      live_agents: agents.filter((a) => a.status === "live").length,
      idle_agents: agents.filter((a) => a.status === "idle").length,
      ready_agents: agents.filter((a) => a.status === "ready").length,
      total_sessions: totalSessions.length,
      active_sessions: activeSessions.length,
      agents,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/agent/communications — get recent communications for simulation center
router.get("/communications", async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 100;
    const comms = await Communication.find()
      .populate("customer_id")
      .sort({ created_at: -1 })
      .limit(limit)
      .lean();
    res.json(comms);
  } catch (err) {
    next(err);
  }
});

// POST /api/agent/chat — proxy chat queries to the AI service
router.post("/chat", async (req, res, next) => {
  try {
    const { message, history, customer_name } = req.body;
    const r = await axios.post(`${AI_SERVICE_URL}/agent/chat`, {
      message,
      history,
      customer_name
    });
    res.json(r.data);
  } catch (err) {
    next(err);
  }
});

// Proxy routes to AI Service
router.post("/ideate", async (req, res, next) => {
  try {
    const r = await axios.post(`${AI_SERVICE_URL}/agent/ideate`, req.body);
    res.json(r.data);
  } catch (err) {
    next(err);
  }
});

router.post("/generate-journey", async (req, res, next) => {
  try {
    const r = await axios.post(`${AI_SERVICE_URL}/agent/generate-journey`, req.body);
    res.json(r.data);
  } catch (err) {
    next(err);
  }
});

router.post("/segment-preview", async (req, res, next) => {
  try {
    const r = await axios.post(`${AI_SERVICE_URL}/agent/segment-preview`, req.body);
    res.json(r.data);
  } catch (err) {
    next(err);
  }
});

router.post("/message-preview", async (req, res, next) => {
  try {
    const r = await axios.post(`${AI_SERVICE_URL}/agent/message-preview`, req.body);
    res.json(r.data);
  } catch (err) {
    next(err);
  }
});

router.post("/blast-segment", async (req, res, next) => {
  try {
    const r = await axios.post(`${AI_SERVICE_URL}/agent/blast-segment`, req.body);
    res.json(r.data);
  } catch (err) {
    next(err);
  }
});

// POST /api/agent/blast — emit messages to simulated devices via socket
// Called by the AI service tool to push messages to the Simulation Center in real time
router.post("/blast", async (req, res) => {
  try {
    const { messages } = req.body;
    // messages: [{ customer_id, customer_name, channel, message, sender }]
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array required" });
    }

    // Create a Campaign in MongoDB to represent this chatbot direct action
    const channel = messages[0]?.channel || "whatsapp";
    const campaignName = `AI Chatbot Campaign - ${new Date().toLocaleDateString()}`;
    const campaign = await Campaign.create({
      name: campaignName,
      goal: "winback",
      channel: channel === "multi" ? "whatsapp" : channel,
      status: "running",
      created_by_agent: true,
      created_at: new Date(),
    });

    // Create corresponding Communication records in MongoDB
    const comms = messages.map((m) => ({
      campaign_id: campaign._id,
      customer_id: m.customer_id,
      channel: m.channel || "whatsapp",
      personalized_body: m.message,
      status: "sent",
      sent_at: new Date(),
      events: [{ event: "sent", timestamp: new Date() }],
    }));
    const savedComms = await Communication.insertMany(comms);

    // Fetch customer details to send along with socket events
    const customerIds = messages.map((m) => m.customer_id);
    const customersInfo = await Customer.find({ _id: { $in: customerIds } }).lean();
    const customerMap = {};
    customersInfo.forEach((c) => {
      customerMap[String(c._id)] = c;
    });

    const io = req.io;
    const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // Emit each message to the Simulation Center with unique IDs and details
    messages.forEach((m, i) => {
      const comm = savedComms.find(c => String(c.customer_id) === String(m.customer_id));
      const cust = customerMap[String(m.customer_id)];
      setTimeout(() => {
        io.emit("device:message_added", {
          customer_id: m.customer_id,
          customer_name: cust?.name || m.customer_name || "Unnamed Customer",
          phone: cust?.phone || "",
          email: cust?.email || "",
          communication_id: comm ? comm._id : null,
          campaign_id: campaign._id,
          channel: m.channel || "whatsapp",
          sender: m.sender || "Zari CRM",
          message: m.message,
          timestamp: ts,
        });
      }, i * 120);
    });

    // Update campaign metrics summary counts
    campaign.metrics_summary = {
      sent: messages.length,
      delivered: 0,
      opened: 0,
      clicked: 0,
      converted: 0,
      failed: 0,
    };
    await campaign.save();

    // Emit campaign:created so that frontend lists can catch it in real time
    io.emit("campaign:created", campaign);

    // Also emit a summary event so the AgentChat console can show progress
    io.emit("agent:blast_sent", {
      count: messages.length,
      preview: messages.slice(0, 3).map((m) => ({
        customer_name: m.customer_name,
        channel: m.channel,
        message: m.message.slice(0, 80),
      })),
    });

    res.json({ ok: true, dispatched: messages.length, campaign_id: campaign._id });
  } catch (err) {
    console.error("[Blast] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
