<div align="center">

# 🧠 Zari CRM — Agentic Marketing Platform

**An AI-native CRM powered by multi-agent LangGraph orchestration, real-time WebSocket sync, and WhatsApp campaign delivery.**

[![Node.js](https://img.shields.io/badge/Backend-Node.js%2020-green?style=flat-square&logo=node.js)](https://nodejs.org)
[![React](https://img.shields.io/badge/Frontend-React%2018-blue?style=flat-square&logo=react)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/AI%20Service-FastAPI-teal?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB-brightgreen?style=flat-square&logo=mongodb)](https://mongodb.com)
[![Gemini](https://img.shields.io/badge/LLM-Gemini%202.0%20Flash-orange?style=flat-square&logo=google)](https://ai.google.dev)

</div>

---

## 📁 Project Structure

```
agentic-crm/
├── frontend/            →  React 18 + Vite 5 + Tailwind — Dashboard UI
├── backend/             →  Express + Node.js + Socket.io — Main API & WebSocket hub
├── ai-service/          →  FastAPI + LangGraph — Multi-agent AI orchestration
├── channel-service/     →  Node.js — Email / SMS delivery simulator
├── whatsapp-service/    →  Node.js + Baileys — Real WhatsApp messaging
├── scripts/             →  Database seeding scripts
├── docker-compose.yml   →  MongoDB + Qdrant containers
└── start.ps1            →  One-click dev launcher (Windows)
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend  :5173                       │
│              React + Vite + Socket.io client             │
└──────────────────────┬──────────────────────────────────┘
                       │  REST + WebSocket
┌──────────────────────▼──────────────────────────────────┐
│                   Backend API  :3001                     │
│         Express + MongoDB + Socket.io server             │
│   ┌──────────┬──────────┬──────────┬──────────────────┐ │
│   │Customers │Campaigns │Segments  │ Analytics / Agent│ │
│   │ Orders   │Journeys  │ Personas │ Webhooks / Offers│ │
│   └──────────┴──────────┴──────────┴──────────────────┘ │
└───────┬────────────────────────────────────┬────────────┘
        │ HTTP                               │ HTTP
┌───────▼──────────────┐          ┌──────────▼────────────┐
│   AI Service  :8000  │          │ Channel Service :3002  │
│  FastAPI + LangGraph │          │ Email / SMS simulator  │
│  ┌─────────────────┐ │          └───────────────────────┘
│  │ Agent Graph:    │ │
│  │ • Supervisor    │ │          ┌───────────────────────┐
│  │ • Segmentation  │ │          │ WhatsApp Service :3003 │
│  │ • Campaign AI   │ │─────────▶│ Baileys — Real msgs   │
│  │ • Personalizer  │ │          └───────────────────────┘
│  │ • Analytics     │ │
│  └─────────────────┘ │          ┌───────────────────────┐
│  Gemini 2.0 Flash LLM│          │  MongoDB       :27017  │
│  Qdrant Vector Store │          │  Qdrant        :6333   │
└──────────────────────┘          └───────────────────────┘
```

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🤖 **AI Agent Chat** | Natural language → full campaign execution via LangGraph multi-agent graph |
| 🎯 **Smart Segmentation** | RFM analysis + MongoDB aggregation pipelines find the right audience |
| 📝 **AI Copywriting** | Gemini 2.0 Flash generates personalized messages per customer |
| 📱 **WhatsApp Campaigns** | Real WhatsApp delivery via Baileys library |
| 📧 **Email / SMS** | Simulated multi-channel delivery with full tracking |
| 📊 **Simulation Center** | Watch customer devices receive messages in real-time |
| ⚡ **Live Activity Feed** | Campaign stats update live via WebSocket (Sent → Delivered → Opened → Clicked → Purchased) |
| 🛡️ **DLQ + Retry** | Dead Letter Queue with exponential backoff retry pipeline |
| 📈 **Analytics** | Delivery funnel, open rates, CTR, conversion with timing breakdown |
| 🗺️ **Journey Builder** | Multi-step automated customer journeys with triggers and waits |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 20+
- **Python** 3.11+ with `pip`
- **Docker Desktop** (for MongoDB + Qdrant)
- **Gemini API Key** — free at [aistudio.google.com](https://aistudio.google.com/app/apikey)

---

### Step 1 — Start the Database

```bash
docker compose up mongodb qdrant -d
```

Verify they're ready:
```bash
docker compose logs mongodb | grep "ready to accept"
docker compose logs qdrant  | grep "Qdrant startup"
```

---

### Step 2 — Configure API Key

Open `ai-service/.env` and set your Gemini key:
```env
GOOGLE_API_KEY=your_gemini_key_here
```

---

### Step 3 — Seed the Database *(one-time)*

```bash
cd scripts/seed
npm install
node seed_customers.js     # 550 customers
node seed_orders.js        # 2000+ orders
node seed_products.js      # Fashion product catalog
node seed_personas.js      # AI customer personas
node seed_offers.js        # Marketing offers
node seed_journeys.js      # Customer journeys

# Seed Qdrant vector store (RAG data)
cd ../../ai-service
python -m scripts.seed_qdrant
```

---

### Step 4 — Start All Services

#### ▶️ Windows — One Command
```powershell
.\start.ps1
```
Opens 4 terminal windows automatically.

#### 🐧 Manual (Linux / Mac / Windows)

```bash
# Terminal 1 — Backend API
cd backend && npm install && npm run dev
# → http://localhost:3001

# Terminal 2 — Channel Service
cd channel-service && npm install && npm run dev
# → http://localhost:3002

# Terminal 3 — AI Service
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# → http://localhost:8000

# Terminal 4 — Frontend
cd frontend && npm install && npm run dev
# → http://localhost:5173
```

---

### Step 5 — Try It

Open **http://localhost:5173** → navigate to **Agent Chat** and type:

> *"Find customers who haven't purchased in 60 days and send them a 20% re-engagement offer on WhatsApp"*

Watch the multi-agent graph execute in real time.

---

## 🧪 Service Ports Reference

| Service | Port | Tech Stack |
|---|---|---|
| Frontend | `5173` | React 18 + Vite + Tailwind |
| Backend API | `3001` | Express + Node.js + Socket.io |
| AI Service | `8000` | FastAPI + LangGraph + Gemini |
| Channel Service | `3002` | Node.js (Email/SMS stub) |
| WhatsApp Service | `3003` | Node.js + Baileys |
| MongoDB | `27017` | Document database |
| Qdrant | `6333` | Vector store (RAG) |

---

## 💡 Example Agent Queries

```
"Create a Diwali campaign for VIP customers (LTV > 5000) with a 25% exclusive offer"

"Re-engage churned customers with a winback email and track conversions"

"Find new customers who made their first purchase last week and send a welcome WhatsApp"

"Analyze last month's campaigns and suggest the top 3 optimizations"

"Send a birthday offer to all customers with birthdays this week"
```

---

## 🔧 Troubleshooting

| Problem | Fix |
|---|---|
| MongoDB connection refused | `docker compose up mongodb -d` |
| Agent finds 0 customers | Run `scripts/seed/seed_customers.js` |
| WhatsApp needs re-auth | Delete `whatsapp-service/auth_info_baileys/` and restart |
| Frontend can't reach backend | Check `frontend/.env` → `VITE_API_URL=http://localhost:3001` |
| AI service import errors | Run `pip install -r ai-service/requirements.txt` in a venv |

---

## 🛠️ Tech Stack

**Frontend:** React 18, Vite, Tailwind CSS, Socket.io client, Recharts, Lucide React, React Router  
**Backend:** Express, Mongoose, Socket.io, Axios, Node.js 20  
**AI Service:** FastAPI, LangGraph, LangChain, Gemini 2.0 Flash, Qdrant, Python 3.11  
**Channel Service:** Express, Node.js (Email/SMS simulation + DLQ)  
**WhatsApp:** Baileys (unofficial WhatsApp Web API)  
**Database:** MongoDB (primary), Qdrant (vector/RAG)  
**DevOps:** Docker Compose, Nodemon  
