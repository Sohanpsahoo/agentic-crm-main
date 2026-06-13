# Agentic CRM - Complete Workflow Analysis

## Executive Summary
✅ **Architecture is well-designed** with a proper multi-service microservices setup.
⚠️ **Several configuration mismatches** between Docker and local development environments.
❌ **Critical issues found** that prevent the complete workflow from executing end-to-end.

---

## Architecture Overview

### Services & Ports
```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (5173)                         │
│                  React + Vite + Socket.io                       │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                    Backend API (3001)                           │
│          Express + Node.js + Socket.io                          │
│    ┌─────────────┬──────────────┬─────────────┐                │
│    │  Customers  │  Campaigns   │  Segments   │                │
│    │  Orders     │  Analytics   │  Journeys   │                │
│    │  Personas   │  Offers      │  Webhooks   │                │
│    └─────────────┴──────────────┴─────────────┘                │
└──┬──────────────────────────────────────────────────────────┬──┘
   │                                                           │
┌──▼────────────────────────┐                  ┌──────────────▼──┐
│   AI Service (8000)        │                  │ Channel Service  │
│   FastAPI + LangGraph      │                  │    (3002)        │
│ ┌──────────────────────┐   │                  │ ┌──────────────┐ │
│ │ Multi-Agent Graph:   │   │                  │ │ Email/SMS    │ │
│ │ - Supervisor         │   │                  │ │ Simulator    │ │
│ │ - Segmentation       │   │                  │ │ (Stubbed)    │ │
│ │ - Campaign Creator   │   │                  │ └──────────────┘ │
│ │ - Personalization    │   │                  └──────────────────┘
│ │ - Channel Selection  │   │
│ │ - Human Approval     │   │              ┌──────────────────┐
│ │ - Analytics          │   │              │ WhatsApp Service │
│ │ - Optimization       │   │              │   (3003)         │
│ │ - Journey Builder    │   │              │ ┌──────────────┐ │
│ └──────────────────────┘   │              │ │ Baileys QR   │ │
│                            │              │ │ Real WhatsApp│ │
│ RAG Vector Store:          │              │ └──────────────┘ │
│ - Sentence Transformers    │              └──────────────────┘
│ - Qdrant (6333)            │
└────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    Data Layer                                    │
│  ┌───────────────┐              ┌──────────────────────────┐    │
│  │   MongoDB     │              │   Qdrant Vector Store    │    │
│  │   (27017)     │              │   (6333)                 │    │
│  │ - Customers   │              │ - Campaign Performance   │    │
│  │ - Orders      │              │ - Brand Voice RAG        │    │
│  │ - Campaigns   │              │ - Segment Profiles       │    │
│  │ - Personas    │              │ - Embeddings             │    │
│  └───────────────┘              └──────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

---

## Critical Workflow: "Natural Language → Executed Campaign"

### Step 1: User Input (Frontend)
```
URL: http://localhost:5173/agent
Action: User types natural language query
Example: "Find customers who haven't purchased in 90 days and send them 
         a loyalty discount via WhatsApp"
Output: POST /api/agent/task → Backend
```

### Step 2: Backend Task Dispatch
```
File: backend/src/routes/agent.js
- Receives query
- Generates session_id (UUID)
- Emits "agent:started" via WebSocket to frontend
- Calls AI Service: POST /run
- Returns 202 "started" to client
```

### Step 3: AI Service Graph Execution
```
File: ai-service/app/graph/graph.py
Nodes (in sequence):

1. SUPERVISOR NODE
   - Parses query with Gemini 2.0 Flash
   - Creates execution plan
   - Routes to next steps (segment → campaign → execute)

2. SEGMENTATION NODE
   - Creates MongoDB aggregation pipeline
   - Finds matching customers
   - Example: {tags: "churned", last_purchase_at: {$gte: 90d}}

3. CAMPAIGN CREATION NODE
   - Generates offer details
   - Creates campaign metadata
   - Calculates budget

4. PERSONALIZATION NODE
   - Uses RAG to fetch brand voice from Qdrant
   - Generates personalized message copy
   - Uses Gemini 2.0 Flash

5. CHANNEL SELECTION NODE
   - Analyzes customer channel preferences
   - Selects best channel (WhatsApp/Email/SMS)
   - Routes to correct channel service

6. HUMAN APPROVAL NODE
   - If >1000 customers, pauses execution
   - Waits for /resume with approval
   - Backend emits "agent:awaiting_approval"

7. EXECUTION NODE
   - Calls Channel Service or WhatsApp Service
   - Sends messages to customers
   - Tracks delivery status

8. ANALYTICS NODE
   - Measures open rate, CTR, conversion
   - Calculates ROI

9. OPTIMIZATION NODE
   - Suggests improvements
   - Proposes revised copy
   - AI diagnosis of why it underperformed

10. JOURNEY BUILDER NODE
    - Creates automated customer journey
    - Saves to Backend → MongoDB
```

### Step 4: Real-Time Progress Updates
```
File: ai-service/app/utils/callbacks.py
- AI Service calls: POST /api/agent/progress
- Backend receives and emits via WebSocket: "agent:progress"
- Frontend updates UI in real-time with agent steps

Example event:
{
  session_id: "abc-123",
  agent: "segmentation",
  message: "Found 234 churned customers",
  data: { size: 234 }
}
```

### Step 5: Message Delivery

#### Path A: WhatsApp (Real)
```
Execution Node calls:
  POST http://localhost:3003/send
  with { to: "+919876543210", message: "..." }

WhatsApp Service (Baileys):
  - Converts phone to JID format
  - Validates WhatsApp connection (needs QR scan)
  - Sends real message via WhatsApp API
  - Tracks delivery status via socket.io
```

#### Path B: Channel Service (Simulated)
```
Execution Node calls:
  POST http://localhost:3002/send
  with { channel: "email", recipient: "..." }

Channel Service:
  - Simulates delivery with configurable rates:
    - DELIVERY_RATE: 96%
    - OPEN_RATE: 54%
    - CLICK_RATE: 24%
    - CONVERSION_RATE: 9%
  - Calls webhook: POST /api/webhooks/channel
  - Backend logs results
```

### Step 6: Results & Analytics
```
Frontend receives:
  - "agent:completed" event with final result
  - Campaign ID for tracking
  - Metrics summary
  - Personalized messages sent
  - Estimated ROI

User can:
  - View campaign in Campaigns page
  - Monitor in real-time via Campaign Monitor
  - Check analytics in Analytics page
```

---

## Configuration Analysis

### ✅ Correct Configurations

**Frontend (.env)**
```
VITE_API_URL=http://localhost:3001        ✓ Correct
VITE_WS_URL=http://localhost:3001         ✓ Correct
```

**WhatsApp Service (.env)**
```
PORT=3003                                   ✓ Correct
CRM_BACKEND_URL=http://localhost:3001      ✓ Correct
AUTH_FOLDER=./auth_info_baileys            ✓ Correct
```

**AI Service (.env)**
```
MONGODB_URI=mongodb://localhost:27017/crm ✓ Correct (local dev)
QDRANT_URL=http://localhost:6333          ✓ Correct
GOOGLE_API_KEY=AQ.Ab8RN6Iah_...           ✓ Present (Gemini)
BACKEND_URL=http://localhost:3001         ✓ Correct
PORT=8000                                   ✓ Correct
GEMINI_MODEL=gemini-2.0-flash              ✓ Correct
```

**Channel Service (.env)**
```
CRM_WEBHOOK_URL=http://localhost:3001/api/webhooks/channel ✓ Correct
PORT=3002                                   ✓ Correct
DELIVERY_RATE=0.96                         ✓ Correct
```

### ⚠️ Configuration Mismatch

**Backend (.env)**
```
MONGODB_URI=mongodb://mongodb:27017/crm   ❌ WRONG for local dev
                      ↓
            Should be: mongodb://localhost:27017/crm

AI_SERVICE_URL=http://ai-service:8000     ❌ WRONG for local dev
                        ↓
            Should be: http://localhost:8000

CHANNEL_SERVICE_URL=http://channel-service:3002  ❌ WRONG for local dev
                            ↓
            Should be: http://localhost:3002
```

**Problem:** Backend .env is configured for **Docker Compose** (using container names),
but services are not running in Docker. This causes API calls to fail.

---

## Testing Results

### ✅ Working Services

1. **WhatsApp Service**
   ```
   curl http://localhost:3003/health
   Response: {"status":"ok","wa":{"status":"ready","phone":"919938226067",...}}
   ✓ Service running
   ✓ Connected to WhatsApp
   ✓ Error handling fixed (no endless loop)
   ```

### ❌ Not Running / Not Tested

1. **MongoDB**
   - Not accessible at localhost:27017
   - Docker container likely not running
   - Impact: Backend cannot connect to database

2. **Backend API**
   - http://localhost:3001/health → Connection refused
   - Cannot start without MongoDB
   - Cannot dispatch AI tasks

3. **AI Service**
   - http://localhost:8000 → Not accessible
   - Requires MongoDB + Qdrant + Backend running
   - Cannot execute agent graph

4. **Channel Service**
   - Not tested
   - Likely not running

5. **Frontend**
   - UI likely builds but cannot connect to backend
   - Agent Chat page will fail to submit queries

---

## Step-by-Step Setup Required

### 1. Fix Backend Environment Variables
```bash
# backend/.env
MONGODB_URI=mongodb://localhost:27017/crm      # Change from mongodb:27017
AI_SERVICE_URL=http://localhost:8000           # Change from ai-service:8000
CHANNEL_SERVICE_URL=http://localhost:3002      # Change from channel-service:3002
PORT=3001
NODE_ENV=development
```

### 2. Start MongoDB & Qdrant (Docker)
```bash
docker compose up mongodb qdrant -d
# Wait for containers to start
docker compose logs mongodb    # Should show "ready to accept connections"
```

### 3. Seed Database
```bash
cd scripts/seed
npm install
node seed_customers.js      # 550 customers
node seed_orders.js         # 2000+ orders
node seed_products.js       # Fashion products
node seed_personas.js       # AI personas
node seed_offers.js         # Marketing offers
node seed_journeys.js       # Customer journeys
cd ../../ai-service
python -m scripts.seed_qdrant  # RAG data
```

### 4. Install Dependencies
```bash
# Backend
cd backend && npm install

# AI Service
cd ../ai-service && pip install -r requirements.txt

# Channel Service
cd ../channel-service && npm install

# Frontend
cd ../frontend && npm install
```

### 5. Start Services (5 terminals)
```bash
# Terminal 1: Backend
cd backend && npm run dev
# → http://localhost:3001

# Terminal 2: AI Service
cd ai-service && uvicorn app.main:app --reload --port 8000
# → http://localhost:8000

# Terminal 3: Channel Service
cd channel-service && npm run dev
# → http://localhost:3002

# Terminal 4: WhatsApp Service (already running on 3003)
# Keep running as is

# Terminal 5: Frontend
cd frontend && npm run dev
# → http://localhost:5173
```

### 6. Test Agent Workflow
```bash
1. Open http://localhost:5173/agent
2. Scan WhatsApp QR code at /whatsapp-setup page
3. Enter query:
   "Find customers who have not purchased in 90 days and send them 
    a loyalty discount via WhatsApp"
4. Watch real-time agent execution
5. View campaign results
```

---

## Potential Issues Found

### 1. ❌ Database Configuration Mismatch
- **Location:** backend/.env
- **Issue:** Uses Docker container names instead of localhost
- **Impact:** Backend cannot connect to MongoDB
- **Fix:** Update MONGODB_URI to `mongodb://localhost:27017/crm`

### 2. ✅ WhatsApp Service Restart Loop (FIXED)
- **Issue:** Nodemon kept restarting on auth credential changes
- **Solution Applied:** Created nodemon.json with proper ignore patterns
- **Status:** NOW WORKING - Service stable on port 3003

### 3. ⚠️ Missing Database Seeding
- **Issue:** Database likely empty (no customers/orders)
- **Impact:** Agent segmentation will find 0 customers
- **Fix:** Run all seed scripts before testing

### 4. ⚠️ RAG Data Not Ingested
- **Issue:** Qdrant empty - no brand voice corpus
- **Impact:** Personalization node will have no context
- **Fix:** Run seed_qdrant.py script

### 5. ⚠️ Gemini API Key Validation
- **Location:** ai-service/.env
- **Key Present:** AQ.Ab8RN6Iah_...
- **Status:** Need to verify key is valid and not rate-limited

### 6. ✅ WhatsApp QR Scan Required
- **Status:** Already connected to phone number 919938226067
- **Good:** Service can send real WhatsApp messages

---

## End-to-End Workflow Checklist

- [ ] Fix backend .env (MongoDB + service URLs)
- [ ] Start MongoDB + Qdrant Docker containers
- [ ] Seed all database collections
- [ ] Seed Qdrant with brand voice + RAG data
- [ ] Install dependencies (all services)
- [ ] Start Backend API (3001)
- [ ] Start AI Service (8000)
- [ ] Start Channel Service (3002)
- [ ] Verify Frontend can connect (5173)
- [ ] Test health endpoint: GET /api/health
- [ ] Test agent task dispatch: POST /api/agent/task
- [ ] Monitor AI service graph execution
- [ ] Verify message delivery (WhatsApp + Channel)
- [ ] Check analytics results
- [ ] View campaign details

---

## Recommendations

### Immediate Actions (Critical)
1. Update backend/.env with localhost URLs
2. Verify Docker MongoDB + Qdrant are running
3. Seed all required data

### Short-term (Important)
1. Add .env validation at service startup
2. Add database connection health checks
3. Create Docker Compose override for local development
4. Add data seeding to automated setup script

### Long-term (Enhancement)
1. Use environment variable files for different deployment modes
2. Add startup wizard to guide users
3. Create dashboard showing service health
4. Add data import/export utilities

---

## Architecture Strengths

✅ Multi-agent LangGraph design allows complex workflows
✅ Real WhatsApp integration via Baileys  
✅ RAG system for brand-aware personalization
✅ Real-time WebSocket updates for agent progress
✅ Modular service architecture (easy to scale)
✅ MongoDB + Qdrant for flexible data storage
✅ Comprehensive seed data for testing
✅ Channel simulation for testing without real APIs

---

## Conclusion

The **Agentic CRM is architecturally sound** but requires proper configuration and services to be running. The main issue is the **backend environment configuration mismatch** between Docker and local development. Once fixed and all services are started, the complete workflow from natural language query to executed campaign should work as designed.

**Current Status:** 
- ✅ WhatsApp Service: Working
- ❌ Backend + Database: Not running (config needed)
- ❌ AI Service: Not running (awaiting backend)
- ❌ Channel Service: Not running
- ❌ Frontend: Not running
