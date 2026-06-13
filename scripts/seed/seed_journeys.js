require("dotenv").config({ path: "../../backend/.env" });
const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/crm";


const JOURNEYS = [
  {
    name: "Welcome Series",
    description: "3-step onboarding journey for new customers",
    trigger: { type: "signup", config: {} },
    status: "active",
    steps: [
      {
        step_id: "s1",
        type: "message",
        config: { campaign_goal: "welcome", channel: "whatsapp" },
        next_step_id: "s2",
      },
      {
        step_id: "s2",
        type: "wait",
        config: { wait_days: 3 },
        next_step_id: "s3",
      },
      {
        step_id: "s3",
        type: "offer",
        config: { campaign_goal: "first_purchase_incentive", channel: "email" },
        next_step_id: null,
      },
    ],
    enrolled_count: 124,
    completed_count: 87,
  },
  {
    name: "90-Day Re-engagement",
    description: "Win back customers silent for 90+ days",
    trigger: { type: "inactivity", config: { days: 90 } },
    status: "active",
    steps: [
      {
        step_id: "s1",
        type: "message",
        config: { campaign_goal: "re-engage", channel: "whatsapp" },
        next_step_id: "s2",
      },
      {
        step_id: "s2",
        type: "condition",
        config: { condition: { field: "opened", value: true } },
        next_step_id: "s3",
        next_step_if_false: "s4",
      },
      {
        step_id: "s3",
        type: "offer",
        config: { campaign_goal: "winback_discount", channel: "whatsapp" },
        next_step_id: null,
      },
      {
        step_id: "s4",
        type: "message",
        config: { campaign_goal: "final_attempt", channel: "sms" },
        next_step_id: null,
      },
    ],
    enrolled_count: 256,
    completed_count: 189,
  },
  {
    name: "Loyalty Milestone Celebration",
    description: "Celebrate when customer crosses loyalty tier thresholds",
    trigger: { type: "points_milestone", config: { milestone: 1000 } },
    status: "active",
    steps: [
      {
        step_id: "s1",
        type: "message",
        config: { campaign_goal: "tier_upgrade_congrats", channel: "whatsapp" },
        next_step_id: "s2",
      },
      {
        step_id: "s2",
        type: "offer",
        config: { campaign_goal: "loyalty_reward", channel: "whatsapp" },
        next_step_id: null,
      },
    ],
    enrolled_count: 43,
    completed_count: 38,
  },
  {
    name: "Birthday Campaign",
    description: "Special birthday message + offer on birthday month",
    trigger: { type: "birthday", config: { days_before: 7 } },
    status: "draft",
    steps: [
      {
        step_id: "s1",
        type: "message",
        config: { campaign_goal: "birthday_wishes", channel: "whatsapp" },
        next_step_id: "s2",
      },
      {
        step_id: "s2",
        type: "offer",
        config: { campaign_goal: "birthday_discount", channel: "email" },
        next_step_id: null,
      },
    ],
    enrolled_count: 0,
    completed_count: 0,
  },
];

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db;
  const collection = db.collection("journeys");

  await collection.deleteMany({});
  const result = await collection.insertMany(JOURNEYS);
  console.log(`Seeded ${result.insertedCount} journeys`);

  await mongoose.disconnect();
  console.log("Done.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
