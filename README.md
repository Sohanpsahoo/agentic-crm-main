# Agentic CRM 🚀

Agentic CRM is an AI-powered Customer Relationship Management platform that leverages autonomous AI agents to orchestrate marketing campaigns, segment audiences, and provide deep analytics insights. 

Built with a modern stack, it features a fully autonomous AI Copilot that can query customer data, write personalized campaign copy, launch omnichannel campaigns (WhatsApp, Email), and monitor real-time conversion metrics.

## 🌟 Key Features

- **AI Copilot (Powered by Groq)**: Talk to your CRM naturally. The AI can generate segments, draft hyper-personalized offers, and launch multi-channel campaigns autonomously.
- **RFM Customer Segmentation**: Automatically segments your database based on Recency, Frequency, and Monetary metrics (e.g., *Champions*, *Loyal*, *At Risk*).
- **Omnichannel Campaign Dispatch**: Launch marketing campaigns via Email, SMS, and WhatsApp directly from the dashboard.
- **Deep Analytics & KPIs**: Visualize Revenue Growth, Channel Performance, Delivery Funnels, and Campaign ROI with interactive, modern charts.
- **AI-Driven Monitoring**: The AI constantly monitors active campaigns, flagging underperforming ones with actionable insights to fix conversion rates.

---

## 🏗️ Architecture

The application is structured into three microservices:

1. **`frontend/`**: The modern, responsive UI.
   - Built with **React** & **Vite**.
   - Styled using **Tailwind CSS**.
   - Charts and Visualizations powered by **Recharts**.
   - Icons from **Lucide React**.

2. **`backend/`**: The core API server and data management layer.
   - Built with **Node.js** & **Express**.
   - Data stored in **MongoDB** via **Mongoose**.
   - Handles customer data, campaign records, analytics aggregations, and orchestrates requests to the AI service.

3. **`ai-service/`**: The intelligence engine.
   - Built with **Python** & **FastAPI**.
   - Powered by the ultra-fast **Groq** LLM API.
   - Contains LangChain agents capable of executing multi-step tool calls to query databases and generate insights.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- MongoDB connection string
- Groq API Key

### 1. Setup Backend
```bash
cd backend
npm install
```
Create a `.env` file in the `backend/` directory:
```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
GROQ_API_KEY=your_groq_api_key
AI_SERVICE_URL=http://127.0.0.1:8000
```
Run the server:
```bash
npm run dev
```

### 2. Setup AI Service
```bash
cd ai-service
pip install -r requirements.txt
```
Create a `.env` file in the `ai-service/` directory:
```env
GROQ_API_KEY=your_groq_api_key
MONGODB_URI=your_mongodb_connection_string
```
Run the FastAPI server:
```bash
uvicorn app.main:app --reload --port 8000
```

### 3. Setup Frontend
```bash
cd frontend
npm install
```
Create a `.env` file in the `frontend/` directory:
```env
VITE_API_URL=http://localhost:5000/api
```
Run the dev server:
```bash
npm run dev
```

---

## 🛠️ Usage Example (AI Chat)

Once all three services are running, open the Frontend in your browser. Navigate to the **Copilot** tab and try asking the AI:

> *"Show me all VIP customers"*
> *"What's our conversion rate this month?"*
> *"Launch a winback WhatsApp campaign for Churned customers with a 20% off offer."*

The AI will intelligently query the MongoDB database, extract the relevant data, formulate a plan, and execute it seamlessly.

---

## 📄 License
This project is licensed under the MIT License.
