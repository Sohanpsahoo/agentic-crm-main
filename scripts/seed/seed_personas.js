require("dotenv").config({ path: "../../backend/.env" });
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/crm";

const CustomerSchema = new mongoose.Schema({
  name: String, email: String, ltv: Number,
  last_purchase_at: Date, total_orders: Number,
  top_categories: [String], tags: [String],
}, { collection: "customers" });

const OrderSchema = new mongoose.Schema({
  customer_id: mongoose.Schema.Types.ObjectId,
  total: Number, placed_at: Date,
}, { collection: "orders" });

const PersonaSchema = new mongoose.Schema({
  customer_id: { type: mongoose.Schema.Types.ObjectId, unique: true },
  rfm: Object, engagement: Object, predicted: Object,
  channel_affinity: Object, recommended_action: Object,
  persona_label: String, interests: [String], last_computed: Date,
}, { collection: "customerpersonas" });

const Customer = mongoose.model("Customer", CustomerSchema);
const Order = mongoose.model("Order", OrderSchema);
const CustomerPersona = mongoose.model("CustomerPersona", PersonaSchema);

const PERSONA_LABELS = {
  Champions: "Fashion-Forward Loyalist", Loyal: "Consistent Buyer",
  "At Risk": "Fading Shopper", "Cannot Lose": "High-Value Lapsing",
  Lost: "Dormant Buyer", New: "Fresh Starter", Potential: "Emerging Customer",
};

const ACTION_MAP = {
  Champions:     { action: "upsell",    urgency: "low",    hint: "Exclusive early access to new collection" },
  Loyal:         { action: "retain",    urgency: "low",    hint: "Loyalty reward — double points this weekend" },
  "At Risk":     { action: "re-engage", urgency: "high",   hint: "We miss you — 20% off just for you" },
  "Cannot Lose": { action: "winback",   urgency: "high",   hint: "Urgent: exclusive offer expires in 48h" },
  Lost:          { action: "winback",   urgency: "medium", hint: "Come back — here's what's new" },
  New:           { action: "nurture",   urgency: "medium", hint: "Welcome — here's your first-purchase offer" },
  Potential:     { action: "nurture",   urgency: "low",    hint: "Curated picks based on your style" },
};

const HOURS = [9, 11, 14, 17, 19, 20];
const CHANNELS = ["whatsapp", "email", "sms"];

function rfm(customer, orderCount, totalSpent) {
  const now = Date.now();
  const days = customer.last_purchase_at
    ? (now - new Date(customer.last_purchase_at).getTime()) / 86400000 : 999;

  const R = days <= 7 ? 5 : days <= 30 ? 4 : days <= 60 ? 3 : days <= 90 ? 2 : 1;
  const F = orderCount >= 10 ? 5 : orderCount >= 6 ? 4 : orderCount >= 3 ? 3 : orderCount >= 2 ? 2 : 1;
  const M = totalSpent >= 20000 ? 5 : totalSpent >= 10000 ? 4 : totalSpent >= 5000 ? 3 : totalSpent >= 1000 ? 2 : 1;

  let segment = "Potential";
  if (R >= 4 && F >= 4 && M >= 4) segment = "Champions";
  else if (F >= 3 && M >= 3) segment = "Loyal";
  else if (R <= 2 && F >= 3) segment = "At Risk";
  else if (R === 1 && F >= 4) segment = "Cannot Lose";
  else if (R === 1 && F <= 2) segment = "Lost";
  else if (R >= 4 && F <= 1) segment = "New";

  return { R, F, M, score: R + F + M, segment };
}

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const customers = await Customer.find({}).lean();
  const orders = await Order.find({}).lean();

  const byCustomer = {};
  for (const o of orders) {
    const id = o.customer_id.toString();
    if (!byCustomer[id]) byCustomer[id] = { count: 0, total: 0 };
    byCustomer[id].count++;
    byCustomer[id].total += o.total || 0;
  }

  let done = 0;
  for (const c of customers) {
    const cid = c._id.toString();
    const { count = 0, total = 0 } = byCustomer[cid] || {};
    const { R, F, M, score, segment } = rfm(c, count, total);

    const churnProb = parseFloat(Math.max(0, Math.min(1, 1 - (R + F) / 10 + (Math.random() * 0.1))).toFixed(2));
    const nextOrderProb = parseFloat(Math.max(0, Math.min(1, (R * 0.4 + F * 0.4 + M * 0.2) / 5)).toFixed(2));
    const winbackProb = R <= 2 && F >= 2
      ? parseFloat(Math.min(1, (F * 0.5 + M * 0.3) / 5 + 0.2).toFixed(2))
      : parseFloat((0.05 + Math.random() * 0.15).toFixed(2));
    const offerSens = parseFloat(Math.max(0, Math.min(1, 0.3 + (5 - R) * 0.1 + Math.random() * 0.2)).toFixed(2));
    const propensity = Math.round(nextOrderProb * 40 + (1 - churnProb) * 30 + offerSens * 20 + (score / 15) * 10);

    const bestHour = HOURS[Math.floor(Math.random() * HOURS.length)];
    const bestChannel = CHANNELS[Math.floor(c._id.toString().charCodeAt(0) % 3)];
    const act = ACTION_MAP[segment] || ACTION_MAP["Potential"];
    const hourStr = bestHour >= 12 ? `${bestHour > 12 ? bestHour - 12 : bestHour} PM` : `${bestHour} AM`;

    await CustomerPersona.findOneAndUpdate(
      { customer_id: c._id },
      {
        customer_id: c._id,
        rfm: { recency_score: R, frequency_score: F, monetary_score: M, rfm_score: score, segment },
        engagement: {
          best_channel: bestChannel,
          best_send_hour: bestHour,
          avg_open_rate: parseFloat((0.2 + Math.random() * 0.6).toFixed(2)),
          avg_click_rate: parseFloat((0.05 + Math.random() * 0.3).toFixed(2)),
        },
        predicted: {
          next_category: (c.top_categories || [])[0] || "Fashion",
          next_purchase_days: Math.round(14 + (1 - nextOrderProb) * 60),
          clv_6m: Math.round(total * 0.8 + nextOrderProb * 5000),
          churn_probability: churnProb,
          offer_sensitivity: offerSens,
          next_order_probability: nextOrderProb,
          winback_probability: winbackProb,
          propensity_score: propensity,
        },
        channel_affinity: {
          whatsapp: parseFloat((bestChannel === "whatsapp" ? 0.7 + Math.random() * 0.3 : 0.2 + Math.random() * 0.3).toFixed(2)),
          email:    parseFloat((bestChannel === "email"    ? 0.7 + Math.random() * 0.3 : 0.2 + Math.random() * 0.3).toFixed(2)),
          sms:      parseFloat((bestChannel === "sms"      ? 0.6 + Math.random() * 0.3 : 0.1 + Math.random() * 0.2).toFixed(2)),
        },
        recommended_action: {
          action: act.action,
          message_hint: act.hint,
          best_send_at: `Today ${hourStr}`,
          urgency: act.urgency,
        },
        persona_label: PERSONA_LABELS[segment],
        interests: c.top_categories || [],
        last_computed: new Date(),
      },
      { upsert: true }
    );
    done++;
    if (done % 50 === 0) console.log(`  ${done}/${customers.length} personas computed`);
  }

  console.log(`✓ Seeded ${done} customer personas`);
  await mongoose.disconnect();
}

seed().catch((e) => { console.error(e); process.exit(1); });
