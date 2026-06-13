require("dotenv").config({ path: "../../backend/.env" });
const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/crm";


const future = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

const OFFERS = [
  {
    name: "Re-engagement 20% Off",
    description: "Win back customers who haven't purchased in 90+ days",
    type: "percentage",
    value: 20,
    code_prefix: "WINBACK",
    auto_generate_codes: true,
    targeting: {
      tags: ["churned"],
      channels: ["whatsapp", "email"],
      min_orders: 1,
    },
    budget: { total_budget: 50000, spent: 0, max_uses: 500, uses_per_customer: 1 },
    validity: { start: new Date(), end: future(90) },
    status: "active",
  },
  {
    name: "VIP Early Access 15% Off",
    description: "Exclusive early access for Gold & Platinum tier members",
    type: "percentage",
    value: 15,
    code_prefix: "VIP15",
    auto_generate_codes: true,
    targeting: {
      tags: ["vip"],
      min_ltv: 10000,
      channels: ["whatsapp"],
    },
    budget: { total_budget: 100000, spent: 0, max_uses: 300, uses_per_customer: 2 },
    validity: { start: new Date(), end: future(30) },
    status: "active",
  },
  {
    name: "New Customer 10% Welcome",
    description: "Welcome offer for first-time buyers",
    type: "percentage",
    value: 10,
    code_prefix: "WELCOME10",
    auto_generate_codes: true,
    targeting: {
      tags: ["new"],
      min_orders: 0,
      channels: ["email", "sms"],
    },
    budget: { total_budget: 75000, spent: 12500, max_uses: 1000, uses_per_customer: 1 },
    validity: { start: new Date(), end: future(60) },
    status: "active",
  },
  {
    name: "Loyalty Multiplier 2x Points",
    description: "Double points on all purchases this weekend",
    type: "points_multiplier",
    value: 2,
    code_prefix: "DOUBLE",
    auto_generate_codes: false,
    targeting: {
      channels: ["whatsapp", "email", "sms"],
    },
    budget: { total_budget: 0, spent: 0, max_uses: 5000, uses_per_customer: 1 },
    validity: { start: new Date(), end: future(3) },
    status: "active",
  },
  {
    name: "Flat ₹500 Off on ₹3000+",
    description: "Minimum purchase offer to increase basket size",
    type: "fixed",
    value: 500,
    code_prefix: "FLAT500",
    auto_generate_codes: true,
    targeting: {
      min_ltv: 3000,
      channels: ["whatsapp", "email"],
    },
    budget: { total_budget: 80000, spent: 8500, max_uses: 800, uses_per_customer: 2 },
    validity: { start: new Date(), end: future(45) },
    status: "active",
  },
];

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db;
  const collection = db.collection("offers");

  await collection.deleteMany({});
  const result = await collection.insertMany(OFFERS);
  console.log(`Seeded ${result.insertedCount} offers`);

  await mongoose.disconnect();
  console.log("Done.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
