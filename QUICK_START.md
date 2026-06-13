# ⚡ Quick Setup Guide

## What You Need to Know

Your CRM application has **5 microservices** that need to run together. The good news: we've fixed critical bugs and configuration issues.

### Services Status
- ✅ **WhatsApp Service (3003)** - Already running & connected
- ⚠️ **Other services** - Need to be started

---

## Quick Start (5 steps)

### Step 1: Start Database & Vector Store (Docker)
```bash
docker compose up mongodb qdrant -d
```

**Wait for them to be ready:**
```bash
# Check logs
docker compose logs mongodb | grep "ready to accept"
docker compose logs qdrant | grep "Qdrant startup"
```

### Step 2: Seed Database (One-time)
```bash
cd scripts/seed
npm install
node seed_customers.js      # Creates 550 customers
node seed_orders.js         # Creates 2000+ orders
node seed_products.js       # Creates fashion products
node seed_personas.js       # Creates AI personas
node seed_offers.js         # Creates marketing offers
node seed_journeys.js       # Creates customer journeys

# Seed RAG vector database
cd ../../ai-service
python -m scripts.seed_qdrant
cd ..
```

### Step 3: Install Dependencies
```bash
# Backend
cd backend && npm install

# AI Service (Python)
cd ../ai-service && pip install -r requirements.txt

# Channel Service
cd ../channel-service && npm install

# Frontend
cd ../frontend && npm install
```

### Step 4: Start Services (Use 4 Terminals)

**Terminal 1 — Backend API**
```bash
cd backend && npm run dev
# Expect: "Backend running on port 3001"
```

**Terminal 2 — AI Service (LangGraph)**
```bash
cd ai-service && uvicorn app.main:app --reload --port 8000
# Expect: "Uvicorn running on http://0.0.0.0:8000"
```

**Terminal 3 — Channel Service**
```bash
cd channel-service && npm run dev
# Expect: "Channel service running on port 3002"
```

**Terminal 4 — Frontend UI**
```bash
cd frontend && npm run dev
# Expect: "http://localhost:5173" in browser
```

> **WhatsApp Service (3003)** should still be running from before

### Step 5: Test the Workflow
```
1. Open http://localhost:5173
2. Navigate to "Agent Chat" 
3. Type a query like:
   "Find customers who haven't purchased in 90 days and send them 
    a 20% discount via WhatsApp"
4. Watch the agent work in real-time!
```

---

## What's Fixed ✅

1. **Backend Configuration** - Updated to use localhost URLs instead of Docker container names
2. **WhatsApp Service** - Fixed endless restart loop (nodemon configuration)
3. **WhatsApp Message IDs** - Fixed undefined message ID response bug
4. **Phone Number Validation** - Now supports multiple countries
5. **Error Handling** - Global error handlers prevent crashes
6. **Input Validation** - Proper validation on all endpoints

---

## Troubleshooting

### MongoDB Connection Refused
```bash
# Check if running
docker compose ps mongodb

# If not running, start it
docker compose up mongodb -d

# Wait 5-10 seconds and try again
```

### Backend Can't Connect to AI Service
```bash
# Check backend/.env
cat backend/.env | grep AI_SERVICE_URL
# Should show: AI_SERVICE_URL=http://localhost:8000

# Make sure AI service is running on port 8000
```

### Frontend Can't Connect to Backend
```bash
# Check frontend/.env
cat frontend/.env | grep VITE_API_URL
# Should show: VITE_API_URL=http://localhost:3001

# Make sure Backend is running on port 3001
```

### Database Is Empty / Agent Finds 0 Customers
```bash
# Run seeding scripts
cd scripts/seed && npm install
node seed_customers.js
```

### WhatsApp Needs Re-Authentication
```bash
# Delete old credentials
rm -rf whatsapp-service/auth_info_baileys

# Service will show new QR code on next start
cd whatsapp-service && npm run dev
# Scan QR with WhatsApp
```

---

## Architecture at a Glance

```
User Types Query
       ↓
Frontend (5173) 
       ↓
Backend API (3001) 
       ↓
AI Service (8000) ← LangGraph Multi-Agent
       ├─ Queries MongoDB
       ├─ Fetches RAG from Qdrant
       ├─ Calls Gemini 2.0 Flash
       ├─ Routes to Channel Service (3002) or WhatsApp Service (3003)
       ↓
Channel Service (3002) - Simulates Email/SMS
       ↓
OR
       ↓
WhatsApp Service (3003) - Real WhatsApp Messages
       ↓
Customer Receives Message & Backend Tracks Results
```

---

## Key Features to Try

### 1. Agent Chat - Natural Language CRM
- Go to **Agent Chat** page
- Type: `"Create a campaign for VIP customers with 25% off"`
- Watch real-time multi-agent execution

### 2. Segments - Smart Customer Groups
- View customer segments by behavior
- RFM (Recency, Frequency, Monetary) analysis

### 3. Campaigns - Multi-Channel Execution
- Create campaigns
- Schedule across WhatsApp, Email, SMS
- Track performance in real-time

### 4. AI Decisioning - Persona-Based Recommendations
- Automatic customer persona detection
- AI-generated next-best-action recommendations
- Personalized message suggestions

### 5. Journey Builder - Automated Workflows
- Create multi-step customer journeys
- Triggers, conditions, and waits
- Execute at scale

### 6. Analytics - Campaign Performance
- Real-time metrics
- Open rates, click-through rates, conversions
- ROI tracking

### 7. WhatsApp Setup - QR Authentication
- Scan QR to authenticate
- Send real WhatsApp messages
- Track delivery status

---

## What You're Building

**Zari CRM** is an AI-native marketing platform:

- 🧠 **Multi-Agent AI** - LangGraph agents coordinate to execute campaigns
- 🎯 **Smart Segmentation** - MongoDB aggregation pipelines find the right customers
- 📝 **AI Copywriting** - Gemini 2.0 Flash generates personalized messages
- 💬 **Real WhatsApp** - Baileys library sends authentic WhatsApp messages
- 📊 **RAG** - Qdrant vector store maintains brand voice & campaign history
- ⚡ **Real-Time Updates** - Socket.io shows agent execution live
- 🏗️ **Modular** - Easily swap services, add new agents

---

## Pro Tips

### 💡 Agent Queries That Work Well
```
"Re-engage customers who haven't purchased in 60 days with a winback offer on WhatsApp"

"Find high-value customers (LTV > 5000) interested in Ethnic Wear and create 
 a personalized Diwali campaign"

"Send a first-purchase incentive (15% off) to new customers via email"

"Analyze last month's campaigns and suggest optimizations"

"Create a welcome journey for sign-ups with 3 automated steps"
```

### 🔧 Database Inspection
```bash
# MongoDB shell
mongosh mongodb://localhost:27017/crm

# List collections
db.getCollectionNames()

# Sample customer
db.customers.findOne()
```

### 📊 Vector Database
```bash
# Qdrant Dashboard
http://localhost:6333/dashboard

# View RAG collections and search vectors
```

---

## Next Steps

1. ✅ Complete the 5-step setup above
2. ✅ Test agent chat with a simple query
3. ✅ Create your first campaign
4. ✅ Monitor execution in real-time
5. ✅ Check analytics and results

---

Need help? Check:
- [WORKFLOW_ANALYSIS.md](./WORKFLOW_ANALYSIS.md) - Complete architecture
- [START.md](./START.md) - Original setup guide
- [docs/index.html](./docs/index.html) - Full documentation

**Status:** ✅ Ready to use (once services are started)
