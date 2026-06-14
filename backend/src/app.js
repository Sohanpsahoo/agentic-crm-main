require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const morgan = require("morgan");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const customerRoutes = require("./routes/customers");
const orderRoutes = require("./routes/orders");
const momentsRoutes = require("./routes/moments");
const segmentRoutes = require("./routes/segments");
const campaignRoutes = require("./routes/campaigns");
const analyticsRoutes = require("./routes/analytics");
const agentRoutes = require("./routes/agent");
const webhookRoutes = require("./routes/webhooks");
const offersRoutes = require("./routes/offers");
const journeysRoutes = require("./routes/journeys");
const productsRoutes = require("./routes/products");
const personasRoutes = require("./routes/personas");
const whatsappRoutes = require("./routes/whatsapp");
const monitorRoutes = require("./routes/monitor");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(cors());
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));

// attach io to req so routes can emit; also set on app for direct access
app.set("io", io);
app.use((req, _res, next) => {
  req.io = io;
  next();
});

app.use("/api/customers", customerRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/moments", momentsRoutes);
app.use("/api/segments", segmentRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/offers", offersRoutes);
app.use("/api/journeys", journeysRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/personas", personasRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/monitor", monitorRoutes);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

const axios = require("axios");

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  
  socket.on("device:message_sent", async (data) => {
    const { customer_id, customer_name, message, history, channel } = data;
    console.log(`[Socket] Device reply from ${customer_name} (${customer_id}): "${message}"`);
    
    // Broadcast message to update client screens instantly
    io.emit("device:message_added", {
      customer_id,
      channel,
      sender: "customer",
      message,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    });

    try {
      const aiServiceUrl = process.env.AI_SERVICE_URL || "http://localhost:8000";
      const response = await axios.post(`${aiServiceUrl}/agent/chat`, {
        message,
        history: history || [],
        customer_name
      });
      
      const replyText = response.data?.reply || `Hi ${customer_name}, thanks for your message!`;
      
      setTimeout(() => {
        io.emit("device:message_added", {
          customer_id,
          channel,
          sender: channel === "email" ? "Zari Fashion" : "Zari CRM",
          message: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        });
      }, 1500);

    } catch (err) {
      console.error("[Socket] Failed to get AI response for device reply:", err.message);
      setTimeout(() => {
        io.emit("device:message_added", {
          customer_id,
          channel,
          sender: channel === "email" ? "Zari Fashion" : "Zari CRM",
          message: `Thanks for messaging us, ${customer_name}! Our support agent will connect with you soon.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        });
      }, 1000);
    }
  });

  socket.on("simulation:update_status", async (data) => {
    const { customer_id, channel, communication_id, status } = data;
    try {
      const Communication = require("./models/Communication");
      const Campaign = require("./models/Campaign");
      
      let comm = null;
      if (communication_id) {
        comm = await Communication.findById(communication_id);
      } else {
        // Find latest communication for this customer and channel
        const query = { customer_id };
        if (channel) query.channel = channel;
        comm = await Communication.findOne(query).sort({ created_at: -1 });
      }
      
      if (comm) {
        // Check if the state transition is valid or skip if already at a further state
        const statusOrder = ["queued", "sent", "delivered", "opened", "clicked", "converted"];
        const currentIdx = statusOrder.indexOf(comm.status);
        const targetIdx = statusOrder.indexOf(status);
        
        if (targetIdx > currentIdx) {
          comm.status = status;
          if (status === "delivered" && !comm.delivered_at) comm.delivered_at = new Date();
          if (status === "opened" && !comm.opened_at) comm.opened_at = new Date();
          if (status === "clicked" && !comm.clicked_at) comm.clicked_at = new Date();
          if (status === "converted" && !comm.converted_at) comm.converted_at = new Date();
          
          comm.events.push({ event: status, timestamp: new Date() });
          await comm.save();
          
          // Recalculate Campaign metrics summary!
          const campaign = await Campaign.findById(comm.campaign_id);
          if (campaign) {
            const allComms = await Communication.find({ campaign_id: campaign._id });
            const summary = {
              sent: 0,
              delivered: 0,
              opened: 0,
              clicked: 0,
              converted: 0,
              failed: 0
            };
            allComms.forEach(c => {
              summary.sent++;
              if (c.status === "delivered" || c.status === "opened" || c.status === "clicked" || c.status === "converted") summary.delivered++;
              if (c.status === "opened" || c.status === "clicked" || c.status === "converted") summary.opened++;
              if (c.status === "clicked" || c.status === "converted") summary.clicked++;
              if (c.status === "converted") summary.converted++;
              if (c.status === "failed") summary.failed++;
            });
            campaign.metrics_summary = summary;
            await campaign.save();
            
            // Emit update so campaigns page refreshes metrics in real-time!
            io.emit("campaign:updated", campaign);
          }
          
          // Emit socket event to notify Simulation Center of status change
          io.emit("communication:status_updated", {
            communication_id: comm._id,
            campaign_id: comm.campaign_id ? String(comm.campaign_id) : null,
            customer_id,
            channel: comm.channel,
            status
          });
        }
      }
    } catch (err) {
      console.error("[Socket] Error updating simulation status:", err.message);
    }
  });

  socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
});

const PORT = process.env.PORT || 3001;

connectDB().then(() => {
  server.listen(PORT, "0.0.0.0", () => console.log(`Backend running on port ${PORT}`));
});

module.exports = { app, io };
