import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout/Layout";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import Segments from "./pages/Segments";
import Campaigns from "./pages/Campaigns";
import CampaignDetail from "./pages/CampaignDetail";
import Analytics from "./pages/Analytics";
import AgentChat from "./pages/AgentChat";
import AIDecisioning from "./pages/AIDecisioning";
import Journeys from "./pages/journeys/Journeys";
import Personas from "./pages/personas/Personas";
import Offers from "./pages/offers/Offers";
import WhatsAppSetup from "./pages/WhatsAppSetup";
import CampaignMonitor from "./pages/CampaignMonitor";
import socket from "./services/socket";
import useAgentStore from "./store/agentStore";

import AdminPortal from "./pages/AdminPortal";

export default function App() {
  const { addEvent, completeSession, setApprovalRequired, startSession } = useAgentStore();

  useEffect(() => {
    socket.on("agent:started", (data) => {
      startSession(data.session_id, data.query);
    });
    socket.on("agent:progress", (data) => {
      addEvent(data.session_id, { type: "progress", ...data });
      if (data.data?.requires_approval) setApprovalRequired(data.session_id);
    });
    socket.on("agent:completed", (data) => completeSession(data.session_id, data.result));
    socket.on("agent:error", (data) => addEvent(data.session_id, { type: "error", message: data.error }));
    socket.on("monitor:alerts", (data) => {
      const count = data.alerts?.length || 0;
      if (count > 0) console.info(`[Monitor] ${count} new alert(s)`);
    });
    return () => {
      socket.off("agent:progress");
      socket.off("agent:completed");
      socket.off("agent:error");
      socket.off("monitor:alerts");
    };
  }, []);

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/segments" element={<Segments />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/campaigns/:id" element={<CampaignDetail />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/offers" element={<Offers />} />
        <Route path="/agent" element={<AgentChat />} />
        <Route path="/ai-decisioning" element={<AIDecisioning />} />
        <Route path="/journeys" element={<Journeys />} />
        <Route path="/personas" element={<Personas />} />
        <Route path="/whatsapp" element={<WhatsAppSetup />} />
        <Route path="/monitor" element={<CampaignMonitor />} />
        <Route path="/admin" element={<AdminPortal />} />
      </Routes>
    </Layout>
  );
}
