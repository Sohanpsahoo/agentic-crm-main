# How to Run — Zari AI CRM

## Prerequisites
- Node.js 20+
- Python 3.11+
- Docker Desktop (for MongoDB + Qdrant)

## Step 1: Start MongoDB + Qdrant
```bash
docker compose up mongodb qdrant -d
```

## Step 2: Get Your FREE Gemini API Key
1. Go to https://aistudio.google.com/app/apikey
2. Create API key
3. Paste into `ai-service/.env` → `GOOGLE_API_KEY=...`

## Step 3: Install Dependencies

```bash
# Backend
cd backend && npm install

# Channel Service
cd ../channel-service && npm install

# AI Service
cd ../ai-service
pip install -r requirements.txt

# Frontend
cd ../frontend && npm install
```

## Step 4: Seed Database
```bash
# MongoDB — customers + orders
cd scripts/seed
npm install
node seed_customers.js
node seed_orders.js

# Qdrant — campaign performance + brand voice RAG data
cd ../../ai-service
python -m scripts.seed_qdrant
# OR directly:
cd ../scripts/seed
python seed_qdrant.py
```

## Step 5: Start All Services (4 terminals)

**Terminal 1 — Backend**
```bash
cd backend && npm run dev
# → http://localhost:3001
```

**Terminal 2 — Channel Service**
```bash
cd channel-service && npm run dev
# → http://localhost:3002
```

**Terminal 3 — AI Service**
```bash
cd ai-service && uvicorn app.main:app --reload --port 8000
# → http://localhost:8000
```

**Terminal 4 — Frontend**
```bash
cd frontend && npm run dev
# → http://localhost:5173
```

## Step 6: Try the AI Agent
Open http://localhost:5173/agent and type:

> "Find customers who have not purchased in 90 days and send them a loyalty discount via WhatsApp"

Watch the agent work in real-time.

## Architecture Ports
| Service | Port | Purpose |
|---|---|---|
| Frontend | 5173 | React UI |
| Backend API | 3001 | Express + WebSocket |
| Channel Service | 3002 | Stubbed delivery |
| AI Service | 8000 | FastAPI + LangGraph |
| MongoDB | 27017 | Database |
| Qdrant | 6333 | Vector store |
