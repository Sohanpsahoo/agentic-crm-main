const axios = require("axios");

const WEBHOOK_URL = process.env.CRM_WEBHOOK_URL || "http://localhost:3001/api/webhooks/channel";

const RATES = {
  delivery: parseFloat(process.env.DELIVERY_RATE || "0.96"),
  open: parseFloat(process.env.OPEN_RATE || "0.54"),
  click: parseFloat(process.env.CLICK_RATE || "0.24"),
  convert: parseFloat(process.env.CONVERT_RATE || "0.09"),
  failure: parseFloat(process.env.FAILURE_RATE || "0.03"),
};

// channel-specific rate multipliers
const CHANNEL_MULTIPLIERS = {
  whatsapp: { open: 1.3, click: 1.1, convert: 1.2 },
  sms:      { open: 1.0, click: 0.7, convert: 0.8 },
  email:    { open: 0.7, click: 0.8, convert: 0.9 },
  rcs:      { open: 1.1, click: 1.0, convert: 1.0 },
};

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// In-memory Dead Letter Queue
const dlq = [];

async function fireCallback(payload) {
  try {
    await axios.post(WEBHOOK_URL, payload, { timeout: 5000 });
  } catch (err) {
    console.error(`Callback failed for ${payload.channel_message_id}: ${err.message}`);
  }
}

async function simulateLifecycle({ channel_message_id, campaign_id, customer_id, channel }) {
  const mult = CHANNEL_MULTIPLIERS[channel] || CHANNEL_MULTIPLIERS.email;
  const minDelay = parseInt(process.env.MIN_DELIVERY_DELAY_MS || "500");
  const maxDelay = parseInt(process.env.MAX_DELIVERY_DELAY_MS || "3000");

  const base = { channel_message_id, campaign_id, customer_id };

  // 1. Sent immediately
  await fireCallback({ ...base, event: "sent" });

  // 2. Delivery / failure
  const failRoll = Math.random();
  if (failRoll < RATES.failure) {
    setTimeout(async () => {
      const reason = "carrier_rejection";
      dlq.push({ ...base, channel, reason, retryCount: 0 });
      await fireCallback({ ...base, event: "failed", metadata: { reason } });
    }, rand(minDelay, maxDelay));
    return;
  }

  const deliverDelay = rand(minDelay, maxDelay);
  setTimeout(async () => {
    const delivered = Math.random() < RATES.delivery;
    if (!delivered) {
      const reason = "undelivered";
      dlq.push({ ...base, channel, reason, retryCount: 0 });
      await fireCallback({ ...base, event: "failed", metadata: { reason } });
      return;
    }

    await fireCallback({ ...base, event: "delivered" });

    // 3. Open
    const openRate = Math.min(RATES.open * mult.open, 0.99);
    if (Math.random() < openRate) {
      setTimeout(async () => {
        await fireCallback({ ...base, event: "opened" });

        // 4. Click
        const clickRate = Math.min(RATES.click * mult.click, 0.99);
        if (Math.random() < clickRate) {
          setTimeout(async () => {
            await fireCallback({ ...base, event: "clicked" });

            // 5. Conversion
            const convertRate = Math.min(RATES.convert * mult.convert, 0.99);
            if (Math.random() < convertRate) {
              setTimeout(async () => {
                await fireCallback({ ...base, event: "converted" });
              }, rand(minDelay * 2, maxDelay * 4));
            }
          }, rand(minDelay, maxDelay * 2));
        }
      }, rand(minDelay * 2, maxDelay * 5));
    }
  }, deliverDelay);
}

function getDLQ() {
  return dlq;
}

function retryDLQ() {
  const toRetry = [...dlq];
  dlq.length = 0; // clear DLQ
  let retriedCount = 0;
  
  toRetry.forEach((msg) => {
    msg.retryCount += 1;
    if (msg.retryCount > 3) {
      // drop permanently after 3 retries
      console.log(`[DLQ] Dropping message ${msg.channel_message_id} permanently after 3 retries.`);
      return;
    }
    retriedCount++;
    console.log(`[DLQ] Retrying message ${msg.channel_message_id} (Attempt ${msg.retryCount})`);
    
    // Simulate lifecycle again but temporarily boost delivery rate to simulate a "fixed" issue
    const originalDeliveryRate = RATES.delivery;
    const originalFailureRate = RATES.failure;
    RATES.delivery = 0.99; // almost guaranteed delivery on retry
    RATES.failure = 0.01;
    
    simulateLifecycle(msg).finally(() => {
      // restore rates after starting simulation
      RATES.delivery = originalDeliveryRate;
      RATES.failure = originalFailureRate;
    });
  });
  
  return { retried: retriedCount };
}

module.exports = { simulateLifecycle, getDLQ, retryDLQ };
