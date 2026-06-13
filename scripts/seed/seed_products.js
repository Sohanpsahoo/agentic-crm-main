require("dotenv").config({ path: "../../backend/.env" });
const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/crm";


const PRODUCTS = [
  // Ethnic Wear
  { sku: "ETH-001", name: "Banarasi Silk Saree", category: "Ethnic Wear", sub_category: "Sarees", price: 4999, compare_at_price: 6499, brand: "Zari", tags: ["silk", "festive", "traditional"], in_stock: true, attributes: { color: "Red", material: "Silk" } },
  { sku: "ETH-002", name: "Anarkali Suit Set", category: "Ethnic Wear", sub_category: "Suits", price: 2999, compare_at_price: 3999, brand: "Zari", tags: ["embroidered", "festive", "cotton"], in_stock: true, attributes: { color: "Navy Blue", material: "Cotton" } },
  { sku: "ETH-003", name: "Chanderi Cotton Kurti", category: "Ethnic Wear", sub_category: "Kurtis", price: 1299, compare_at_price: 1799, brand: "Zari", tags: ["casual", "summer", "cotton"], in_stock: true, attributes: { color: "Mint Green", material: "Chanderi Cotton" } },
  { sku: "ETH-004", name: "Lehenga Choli Set", category: "Ethnic Wear", sub_category: "Lehengas", price: 7999, compare_at_price: 10999, brand: "Zari", tags: ["bridal", "festive", "silk"], in_stock: true, attributes: { color: "Magenta", material: "Raw Silk" } },
  { sku: "ETH-005", name: "Printed Palazzo Set", category: "Ethnic Wear", sub_category: "Palazzos", price: 1599, compare_at_price: 2199, brand: "Zari", tags: ["casual", "printed", "comfortable"], in_stock: true, attributes: { color: "Multicolor", material: "Rayon" } },
  // Western Wear
  { sku: "WES-001", name: "Floral Wrap Dress", category: "Western Wear", sub_category: "Dresses", price: 2499, compare_at_price: 3299, brand: "Zari", tags: ["floral", "summer", "casual"], in_stock: true, attributes: { color: "Yellow Floral", material: "Chiffon" } },
  { sku: "WES-002", name: "High-Rise Skinny Jeans", category: "Western Wear", sub_category: "Bottoms", price: 1999, compare_at_price: 2799, brand: "Zari", tags: ["denim", "casual", "everyday"], in_stock: true, attributes: { color: "Indigo", material: "Denim" } },
  { sku: "WES-003", name: "Crop Blazer Co-ord Set", category: "Western Wear", sub_category: "Co-ords", price: 3499, compare_at_price: 4499, brand: "Zari", tags: ["office", "chic", "structured"], in_stock: true, attributes: { color: "Camel", material: "Polyester Blend" } },
  { sku: "WES-004", name: "Ruffle Sleeve Blouse", category: "Western Wear", sub_category: "Tops", price: 1199, compare_at_price: 1599, brand: "Zari", tags: ["casual", "ruffles", "summer"], in_stock: true, attributes: { color: "White", material: "Cotton" } },
  { sku: "WES-005", name: "Pleated Midi Skirt", category: "Western Wear", sub_category: "Bottoms", price: 1799, compare_at_price: 2399, brand: "Zari", tags: ["pleated", "elegant", "office"], in_stock: true, attributes: { color: "Dusty Rose", material: "Satin" } },
  // Accessories
  { sku: "ACC-001", name: "Oxidized Silver Jhumkas", category: "Accessories", sub_category: "Earrings", price: 799, compare_at_price: 1199, brand: "Zari", tags: ["oxidized", "ethnic", "silver"], in_stock: true, attributes: { material: "Silver-plated" } },
  { sku: "ACC-002", name: "Silk Potli Bag", category: "Accessories", sub_category: "Bags", price: 1499, compare_at_price: 1999, brand: "Zari", tags: ["festive", "silk", "clutch"], in_stock: true, attributes: { color: "Gold", material: "Silk" } },
  { sku: "ACC-003", name: "Pearl Choker Necklace", category: "Accessories", sub_category: "Necklaces", price: 999, compare_at_price: 1499, brand: "Zari", tags: ["pearls", "elegant", "versatile"], in_stock: true, attributes: { material: "Faux Pearl" } },
  { sku: "ACC-004", name: "Leather Sling Bag", category: "Accessories", sub_category: "Bags", price: 2299, compare_at_price: 2999, brand: "Zari", tags: ["leather", "casual", "everyday"], in_stock: true, attributes: { color: "Tan", material: "Vegan Leather" } },
  { sku: "ACC-005", name: "Beaded Stackable Bangles", category: "Accessories", sub_category: "Bangles", price: 499, compare_at_price: 799, brand: "Zari", tags: ["beaded", "colorful", "casual"], in_stock: true },
  // Footwear
  { sku: "FOO-001", name: "Block Heel Sandals", category: "Footwear", sub_category: "Heels", price: 2499, compare_at_price: 3299, brand: "Zari", tags: ["heels", "festive", "comfortable"], in_stock: true, attributes: { color: "Gold", material: "Faux Leather" } },
  { sku: "FOO-002", name: "Embroidered Kolhapuri Flats", category: "Footwear", sub_category: "Flats", price: 1299, compare_at_price: 1799, brand: "Zari", tags: ["ethnic", "kolhapuri", "handcrafted"], in_stock: true, attributes: { color: "Tan", material: "Genuine Leather" } },
  { sku: "FOO-003", name: "Platform Sneakers", category: "Footwear", sub_category: "Sneakers", price: 2999, compare_at_price: 3999, brand: "Zari", tags: ["casual", "sporty", "comfortable"], in_stock: true, attributes: { color: "White", material: "Canvas" } },
  { sku: "FOO-004", name: "Strappy Kitten Heels", category: "Footwear", sub_category: "Heels", price: 1999, compare_at_price: 2799, brand: "Zari", tags: ["office", "elegant", "strappy"], in_stock: true, attributes: { color: "Nude", material: "Faux Suede" } },
  // Winterwear
  { sku: "WIN-001", name: "Wool Blend Long Coat", category: "Winterwear", sub_category: "Coats", price: 5999, compare_at_price: 7999, brand: "Zari", tags: ["wool", "winter", "elegant"], in_stock: true, attributes: { color: "Charcoal", material: "Wool Blend" } },
  { sku: "WIN-002", name: "Chunky Knit Cardigan", category: "Winterwear", sub_category: "Sweaters", price: 2499, compare_at_price: 3299, brand: "Zari", tags: ["knit", "cozy", "winter"], in_stock: true, attributes: { color: "Cream", material: "Acrylic Knit" } },
  { sku: "WIN-003", name: "Velvet Shawl", category: "Winterwear", sub_category: "Shawls", price: 1799, compare_at_price: 2499, brand: "Zari", tags: ["velvet", "ethnic", "warm"], in_stock: true, attributes: { color: "Maroon", material: "Velvet" } },
  // Loungewear
  { sku: "LOU-001", name: "Printed Pyjama Set", category: "Loungewear", sub_category: "Pyjamas", price: 999, compare_at_price: 1399, brand: "Zari", tags: ["comfortable", "printed", "sleep"], in_stock: true, attributes: { material: "Cotton" } },
  { sku: "LOU-002", name: "Modal Lounge Shorts Set", category: "Loungewear", sub_category: "Sets", price: 1299, compare_at_price: 1799, brand: "Zari", tags: ["modal", "comfortable", "summer"], in_stock: true, attributes: { color: "Sage Green", material: "Modal" } },
  // Sportswear
  { sku: "SPO-001", name: "High-Waist Yoga Leggings", category: "Sportswear", sub_category: "Leggings", price: 1799, compare_at_price: 2399, brand: "Zari", tags: ["yoga", "activewear", "stretchy"], in_stock: true, attributes: { color: "Black", material: "Nylon Spandex" } },
  { sku: "SPO-002", name: "Sports Bra & Shorts Set", category: "Sportswear", sub_category: "Sets", price: 1999, compare_at_price: 2799, brand: "Zari", tags: ["activewear", "gym", "comfortable"], in_stock: true, attributes: { color: "Coral", material: "Polyester" } },
  // Denim
  { sku: "DEN-001", name: "Boyfriend Denim Jacket", category: "Denim", sub_category: "Jackets", price: 2799, compare_at_price: 3799, brand: "Zari", tags: ["denim", "casual", "boyfriend"], in_stock: true, attributes: { color: "Light Blue", material: "Denim" } },
  { sku: "DEN-002", name: "Distressed Mom Jeans", category: "Denim", sub_category: "Jeans", price: 2299, compare_at_price: 3199, brand: "Zari", tags: ["distressed", "casual", "vintage"], in_stock: true, attributes: { color: "Medium Wash", material: "Denim" } },
  // Festive Collection
  { sku: "FES-001", name: "Zardozi Embellished Cape", category: "Festive", sub_category: "Capes", price: 8999, compare_at_price: 11999, brand: "Zari", tags: ["zardozi", "festive", "luxury"], in_stock: true, attributes: { color: "Royal Blue", material: "Velvet" } },
  { sku: "FES-002", name: "Mirror Work Sharara Set", category: "Festive", sub_category: "Shararas", price: 6499, compare_at_price: 8999, brand: "Zari", tags: ["mirror-work", "festive", "statement"], in_stock: true, attributes: { color: "Emerald Green", material: "Georgette" } },
  // Casual
  { sku: "CAS-001", name: "Linen Shirt Dress", category: "Casual", sub_category: "Dresses", price: 1999, compare_at_price: 2799, brand: "Zari", tags: ["linen", "casual", "summer"], in_stock: true, attributes: { color: "Beige", material: "Linen" } },
  { sku: "CAS-002", name: "Tie-Dye Cropped Tee", category: "Casual", sub_category: "Tops", price: 799, compare_at_price: 1199, brand: "Zari", tags: ["tie-dye", "casual", "trendy"], in_stock: true, attributes: { color: "Multicolor", material: "Cotton" } },
  { sku: "CAS-003", name: "Wide Leg Linen Trousers", category: "Casual", sub_category: "Bottoms", price: 1699, compare_at_price: 2299, brand: "Zari", tags: ["linen", "comfortable", "wide-leg"], in_stock: true, attributes: { color: "Off White", material: "Linen" } },
  // Beauty & Grooming
  { sku: "BEA-001", name: "Rose Gold Makeup Organizer", category: "Beauty", sub_category: "Organizers", price: 1299, compare_at_price: 1799, brand: "Zari", tags: ["organizer", "beauty", "gift"], in_stock: true },
  { sku: "BEA-002", name: "Silk Hair Scrunchie Set (5pc)", category: "Beauty", sub_category: "Hair Accessories", price: 599, compare_at_price: 899, brand: "Zari", tags: ["silk", "hair", "gentle"], in_stock: true },
  // Home & Gifting
  { sku: "HOM-001", name: "Floral Embroidered Cushion Cover", category: "Home & Gifting", sub_category: "Cushions", price: 799, compare_at_price: 1199, brand: "Zari", tags: ["home-decor", "embroidered", "gifting"], in_stock: true, attributes: { material: "Cotton" } },
  { sku: "HOM-002", name: "Handwoven Jute Basket (Set of 3)", category: "Home & Gifting", sub_category: "Storage", price: 1499, compare_at_price: 1999, brand: "Zari", tags: ["jute", "handwoven", "eco-friendly"], in_stock: true },
  // Subscription/Gift Cards
  { sku: "GFT-001", name: "Zari E-Gift Card ₹1000", category: "Gift Cards", sub_category: "Digital", price: 1000, brand: "Zari", tags: ["gift-card", "digital"], in_stock: true },
  { sku: "GFT-002", name: "Zari E-Gift Card ₹2500", category: "Gift Cards", sub_category: "Digital", price: 2500, brand: "Zari", tags: ["gift-card", "digital"], in_stock: true },
];

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db;
  const collection = db.collection("products");

  await collection.deleteMany({});
  const result = await collection.insertMany(PRODUCTS);
  console.log(`Seeded ${result.insertedCount} products`);

  await mongoose.disconnect();
  console.log("Done.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
