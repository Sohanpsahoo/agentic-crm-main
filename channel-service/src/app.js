require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const { simulateLifecycle, getDLQ, retryDLQ } = require("./simulator/lifecycle");

const WA_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || "http://localhost:3003";

async function tryRealWhatsApp(phone, message, message_id) {
  try {
    const r = await axios.post(`${WA_SERVICE_URL}/send`, { to: phone, message, message_id }, { timeout: 8000 });
    return r.data?.success === true;
  } catch {
    return false; // fall back to simulation
  }
}

const app = express();
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

// in-memory stats for demo
const stats = { sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0, failed: 0 };

// POST /send — receive send request, kick off lifecycle simulation
app.post("/send", async (req, res) => {
  const { recipient, channel, message, campaign_id, customer_id, message_id } = req.body;

  if (!recipient || !channel || !message) {
    return res.status(400).json({ error: "recipient, channel, message are required" });
  }

  const channel_message_id = message_id || uuidv4();
  stats.sent++;

  console.log(`[CHANNEL] Sending ${channel} to ${recipient} | msg_id: ${channel_message_id}`);

  if (channel === "whatsapp") {
    // Try real WhatsApp first; fall back to simulation on failure
    tryRealWhatsApp(recipient, message, channel_message_id).then((sent) => {
      if (!sent) simulateLifecycle({ channel_message_id, campaign_id, customer_id, channel });
    });
  } else {
    simulateLifecycle({ channel_message_id, campaign_id, customer_id, channel });
  }

  res.status(202).json({
    channel_message_id,
    status: "queued",
    channel,
    recipient,
  });
});

// POST /send/batch — batch send
app.post("/send/batch", async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array required" });
  }

  const results = messages.map((msg) => {
    const channel_message_id = msg.message_id || uuidv4();
    stats.sent++;

    if (msg.channel === "whatsapp") {
      console.log(`[CHANNEL] Attempting real WhatsApp send to ${msg.recipient} | msg_id: ${channel_message_id}`);
      // Try real WhatsApp first; fall back to simulation on failure
      tryRealWhatsApp(msg.recipient, msg.message, channel_message_id).then((sent) => {
        console.log(`[CHANNEL] Real WhatsApp send result for ${msg.recipient}: ${sent}`);
        if (!sent) {
          simulateLifecycle({
            channel_message_id,
            campaign_id: msg.campaign_id,
            customer_id: msg.customer_id,
            channel: msg.channel,
          });
        }
      });
    } else {
      simulateLifecycle({
        channel_message_id,
        campaign_id: msg.campaign_id,
        customer_id: msg.customer_id,
        channel: msg.channel,
      });
    }

    return { channel_message_id, status: "queued", channel: msg.channel };
  });

  console.log(`[CHANNEL] Batch: ${results.length} messages queued`);
  res.status(202).json({ results, count: results.length });
});

app.get("/stats", (_req, res) => {
  res.json({
    ...stats,
    config: {
      delivery_rate: process.env.DELIVERY_RATE,
      open_rate: process.env.OPEN_RATE,
      click_rate: process.env.CLICK_RATE,
      convert_rate: process.env.CONVERT_RATE,
    },
  });
});

// GET /dlq — get current DLQ state
app.get("/dlq", (_req, res) => {
  res.json({ queue: getDLQ(), count: getDLQ().length });
});

// POST /dlq/retry — trigger DLQ retry
app.post("/dlq/retry", (_req, res) => {
  const result = retryDLQ();
  res.status(202).json({ message: "Retrying DLQ messages", ...result });
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Channel service running on port ${PORT}`));
