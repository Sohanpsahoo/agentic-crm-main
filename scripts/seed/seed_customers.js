require("dotenv").config({ path: "../../backend/.env" });
const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/crm";

const FIRST_NAMES = [
  "Priya","Ananya","Riya","Kavya","Shreya","Meera","Pooja","Neha","Divya","Sunita",
  "Rahul","Arjun","Vikram","Karan","Aditya","Rohan","Siddharth","Nikhil","Deepak","Mohit",
  "Lakshmi","Radha","Gita","Sonia","Nisha","Fatima","Zara","Aisha","Preeti","Smita",
  "Ravi","Suresh","Manoj","Amit","Sachin","Vijay","Ajay","Sandeep","Pawan","Girish",
];

const LAST_NAMES = [
  "Sharma","Patel","Singh","Kumar","Verma","Gupta","Joshi","Mehta","Shah","Agarwal",
  "Reddy","Nair","Iyer","Rao","Menon","Pillai","Krishnan","Kapoor","Malhotra","Bhat",
];

const CITIES = [
  { city: "Mumbai", timezone: "Asia/Kolkata" },
  { city: "Delhi", timezone: "Asia/Kolkata" },
  { city: "Bangalore", timezone: "Asia/Kolkata" },
  { city: "Hyderabad", timezone: "Asia/Kolkata" },
  { city: "Chennai", timezone: "Asia/Kolkata" },
  { city: "Kolkata", timezone: "Asia/Kolkata" },
  { city: "Pune", timezone: "Asia/Kolkata" },
  { city: "Ahmedabad", timezone: "Asia/Kolkata" },
  { city: "Jaipur", timezone: "Asia/Kolkata" },
  { city: "Surat", timezone: "Asia/Kolkata" },
];

const AGE_GROUPS = ["18-24", "25-34", "35-44", "45-54", "55+"];
const GENDERS = ["female", "male", "other"];
const CATEGORIES = ["Ethnic Wear", "Western Wear", "Accessories", "Footwear", "Activewear", "Formal Wear", "Denim", "Kurtas", "Sarees", "Lehengas"];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN(arr, n) {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function generateTags(lastPurchaseDaysAgo, ltv, totalOrders) {
  const tags = [];
  if (ltv > 15000) tags.push("vip");
  if (ltv > 5000) tags.push("high-value");
  if (lastPurchaseDaysAgo > 120) tags.push("churned");
  else if (lastPurchaseDaysAgo > 60) tags.push("at-risk");
  else if (lastPurchaseDaysAgo < 14) tags.push("active");
  if (totalOrders === 1) tags.push("one-time");
  if (totalOrders >= 5) tags.push("loyal");
  if (totalOrders >= 10) tags.push("champion");
  return tags;
}

function generateCustomers(count) {
  const customers = [];
  const emailSet = new Set();

  for (let i = 0; i < count; i++) {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randInt(1, 999)}@example.com`;

    if (emailSet.has(email)) continue;
    emailSet.add(email);

    const location = pick(CITIES);
    const ageGroup = pick(AGE_GROUPS);
    const gender = Math.random() < 0.65 ? "female" : pick(GENDERS);

    const totalOrders = randInt(1, 18);
    const avgOrderValue = randInt(800, 5500);
    const ltv = totalOrders * avgOrderValue + randInt(-500, 500);
    const lastPurchaseDaysAgo = randInt(1, 180);

    const topCategories = pickN(CATEGORIES, randInt(1, 3));
    const tags = generateTags(lastPurchaseDaysAgo, ltv, totalOrders);

    const churnScore = Math.min(
      (lastPurchaseDaysAgo / 180) * 0.6 + (totalOrders <= 1 ? 0.3 : 0) + Math.random() * 0.1,
      1.0
    );

    customers.push({
      name: `${firstName} ${lastName}`,
      email,
      phone: `+91${randInt(7000000000, 9999999999)}`,
      channel_preferences: {
        whatsapp: Math.random() > 0.15,
        sms: Math.random() > 0.1,
        email: true,
        rcs: Math.random() > 0.7,
      },
      location: { ...location, country: "India" },
      demographics: { age_group: ageGroup, gender },
      tags,
      ltv: Math.max(ltv, 0),
      last_purchase_at: daysAgo(lastPurchaseDaysAgo),
      total_orders: totalOrders,
      avg_order_value: avgOrderValue,
      top_categories: topCategories,
      churn_score: parseFloat(churnScore.toFixed(2)),
      predicted_next_category: pick(topCategories) || pick(CATEGORIES),
      created_at: daysAgo(randInt(lastPurchaseDaysAgo, 365)),
    });
  }

  return customers;
}

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db;
  const collection = db.collection("customers");

  await collection.deleteMany({});
  console.log("Cleared customers collection");

  const customers = generateCustomers(550);
  await collection.insertMany(customers);
  console.log(`Seeded ${customers.length} customers`);

  // create indexes
  await collection.createIndex({ last_purchase_at: 1, tags: 1, ltv: 1 });
  await collection.createIndex({ email: 1 }, { unique: true });
  await collection.createIndex({ churn_score: -1 });
  console.log("Indexes created");

  await mongoose.disconnect();
  console.log("Done. Disconnected.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
