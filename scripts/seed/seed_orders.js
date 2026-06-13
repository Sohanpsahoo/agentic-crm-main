require("dotenv").config({ path: "../../backend/.env" });
const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/crm";

const PRODUCTS = [
  { name: "Floral Anarkali Suit", category: "Ethnic Wear", price: 2499 },
  { name: "Cotton Kurta Set", category: "Kurtas", price: 1299 },
  { name: "Banarasi Silk Saree", category: "Sarees", price: 4999 },
  { name: "Embroidered Lehenga", category: "Lehengas", price: 8999 },
  { name: "Denim Jacket", category: "Denim", price: 1799 },
  { name: "Casual T-Shirt Pack", category: "Western Wear", price: 899 },
  { name: "Formal Blazer", category: "Formal Wear", price: 3499 },
  { name: "Running Sneakers", category: "Footwear", price: 2299 },
  { name: "Yoga Pants", category: "Activewear", price: 1199 },
  { name: "Statement Earrings", category: "Accessories", price: 599 },
  { name: "Silk Dupatta", category: "Ethnic Wear", price: 799 },
  { name: "Block Print Kurta", category: "Kurtas", price: 1499 },
  { name: "High-Waist Jeans", category: "Denim", price: 1999 },
  { name: "Athleisure Set", category: "Activewear", price: 2199 },
  { name: "Kolhapuri Sandals", category: "Footwear", price: 1299 },
  { name: "Oxidised Necklace Set", category: "Accessories", price: 899 },
  { name: "Chikankari Kurti", category: "Kurtas", price: 1799 },
  { name: "Maxi Dress", category: "Western Wear", price: 2299 },
  { name: "Palazzo Pants", category: "Ethnic Wear", price: 999 },
  { name: "Sports Bra & Shorts Set", category: "Activewear", price: 1599 },
];

const STATUSES = ["placed", "shipped", "delivered", "delivered", "delivered", "returned"];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db;
  const customersCol = db.collection("customers");
  const ordersCol = db.collection("orders");

  await ordersCol.deleteMany({});
  console.log("Cleared orders collection");

  const customers = await customersCol.find({}).toArray();
  console.log(`Found ${customers.length} customers`);

  const orders = [];
  let orderCounter = 1000;

  for (const customer of customers) {
    const orderCount = customer.total_orders || randInt(1, 5);
    const lastPurchaseDaysAgo = customer.last_purchase_at
      ? Math.floor((Date.now() - new Date(customer.last_purchase_at).getTime()) / (1000 * 60 * 60 * 24))
      : randInt(10, 180);

    for (let i = 0; i < orderCount; i++) {
      const daysOffset = i === 0 ? lastPurchaseDaysAgo : randInt(lastPurchaseDaysAgo + 10, 365);
      const itemCount = randInt(1, 3);
      const items = [];

      for (let j = 0; j < itemCount; j++) {
        const product = pick(PRODUCTS);
        items.push({
          product_id: `PROD_${product.name.replace(/\s/g, "_").toUpperCase()}`,
          name: product.name,
          category: product.category,
          quantity: randInt(1, 2),
          price: product.price + randInt(-100, 200),
        });
      }

      const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const placedAt = daysAgo(daysOffset);
      const status = pick(STATUSES);

      orders.push({
        customer_id: customer._id,
        order_number: `ORD${String(++orderCounter).padStart(6, "0")}`,
        status,
        items,
        total,
        currency: "INR",
        placed_at: placedAt,
        delivered_at: status === "delivered" ? new Date(placedAt.getTime() + 5 * 24 * 60 * 60 * 1000) : null,
        created_at: placedAt,
        updated_at: placedAt,
      });
    }
  }

  // batch insert
  const BATCH = 500;
  for (let i = 0; i < orders.length; i += BATCH) {
    await ordersCol.insertMany(orders.slice(i, i + BATCH));
    process.stdout.write(`\rInserted ${Math.min(i + BATCH, orders.length)}/${orders.length} orders`);
  }

  console.log(`\nSeeded ${orders.length} orders`);

  // create indexes
  await ordersCol.createIndex({ customer_id: 1, placed_at: -1 });
  await ordersCol.createIndex({ placed_at: -1 });
  await ordersCol.createIndex({ status: 1 });
  console.log("Indexes created");

  await mongoose.disconnect();
  console.log("Done.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
