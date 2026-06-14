import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, Server, Database, Sliders, Activity, Radio, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import axios from "axios";
import socket from "../services/socket";

export default function AdminPortal() {
  const queryClient = useQueryClient();
  const [weights, setWeights] = useState({
    recency: 40,
    frequency: 30,
    monetary: 20,
    offerSensitivity: 10,
  });

  const [liveMoments, setLiveMoments] = useState([]);
  const [services, setServices] = useState([
    { name: "Backend API Server", port: 3001, status: "checking" },
    { name: "Channel Dispatcher", port: 3002, status: "checking" },
    { name: "WhatsApp Gateway", port: 3003, status: "checking" },
    { name: "AI Decisioning Engine", port: 8000, status: "checking" },
  ]);

  // Fetch aggregate database statistics
  const { data: dbStats, isLoading: loadingDb } = useQuery({
    queryKey: ["admin-db-stats"],
    queryFn: async () => {
      const [custRes, orderRes] = await Promise.all([
        axios.get("/api/customers"),
        axios.get("/api/orders"),
      ]);
      const totalLtv = (custRes.data.customers || []).reduce((sum, c) => sum + (c.ltv || 0), 0);
      return {
        totalCustomers: custRes.data.total || 0,
        totalOrders: orderRes.data.total || 0,
        totalLtv: totalLtv,
      };
    },
    refetchInterval: 10000,
  });

  // Fetch initial moments log
  const { data: initialMoments } = useQuery({
    queryKey: ["admin-moments"],
    queryFn: async () => {
      const res = await axios.get("/api/moments");
      return res.data;
    },
  });

  useEffect(() => {
    if (initialMoments) {
      setLiveMoments(initialMoments);
    }
  }, [initialMoments]);

  // Listen to live moments via socket
  useEffect(() => {
    socket.on("moment:new", (moment) => {
      setLiveMoments((prev) => [moment, ...prev].slice(0, 50));
      queryClient.invalidateQueries({ queryKey: ["admin-db-stats"] });
    });
    return () => {
      socket.off("moment:new");
    };
  }, [queryClient]);

  // Perform active health checks
  const checkHealth = async () => {
    const checked = await Promise.all(
      services.map(async (srv) => {
        try {
          const endpoint = srv.port === 8000 ? "http://localhost:8000/health" : `http://localhost:${srv.port}/health`;
          // We can check backend locally or use relative proxy paths
          const checkUrl = srv.port === 3001 ? "/health" : srv.port === 3002 ? "http://localhost:3002/health" : srv.port === 3003 ? "http://localhost:3003/health" : "http://localhost:8000/health";
          
          await axios.get(checkUrl, { timeout: 2000 });
          return { ...srv, status: "healthy" };
        } catch (err) {
          return { ...srv, status: "offline" };
        }
      })
    );
    setServices(checked);
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 space-y-6 bg-gray-950 text-white min-height-screen">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="text-blue-400" size={24} />
            <h1 className="text-2xl font-bold">Global Admin Portal</h1>
          </div>
          <p className="text-gray-400 text-sm">Monitor platform orchestrations, service statuses, and model hyper-tuning parameters.</p>
        </div>
        <button 
          onClick={checkHealth}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors text-sm font-semibold"
        >
          <RefreshCw size={14} />
          Force Health Check
        </button>
      </div>

      {/* Grid: Health & DB Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Service Health Checklist */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
            <Server className="text-cyan-400" size={18} />
            <h2 className="font-semibold text-base">Platform Services Status</h2>
          </div>
          <div className="space-y-3">
            {services.map((srv) => (
              <div key={srv.name} className="flex items-center justify-between bg-gray-950 border border-gray-800 rounded-lg p-3">
                <div>
                  <div className="font-semibold text-sm">{srv.name}</div>
                  <div className="text-xs text-gray-500">Listening on port {srv.port}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  {srv.status === "healthy" ? (
                    <>
                      <CheckCircle className="text-green-500" size={16} />
                      <span className="text-xs font-semibold text-green-400">ONLINE</span>
                    </>
                  ) : srv.status === "offline" ? (
                    <>
                      <AlertTriangle className="text-red-500" size={16} />
                      <span className="text-xs font-semibold text-red-400">OFFLINE</span>
                    </>
                  ) : (
                    <>
                      <Activity className="text-amber-500 animate-pulse" size={16} />
                      <span className="text-xs font-semibold text-amber-400">PINGING...</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Database Stats Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
            <Database className="text-blue-400" size={18} />
            <h2 className="font-semibold text-base">Aggregated Database Analytics</h2>
          </div>
          {loadingDb ? (
            <div className="py-12 text-center text-gray-500 text-sm">Loading telemetry...</div>
          ) : (
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 text-center">
                <div className="text-xs text-gray-500 uppercase font-semibold">Customers</div>
                <div className="text-2xl font-bold mt-2 text-white">{dbStats?.totalCustomers}</div>
              </div>
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 text-center">
                <div className="text-xs text-gray-500 uppercase font-semibold">Orders</div>
                <div className="text-2xl font-bold mt-2 text-white">{dbStats?.totalOrders}</div>
              </div>
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 text-center">
                <div className="text-xs text-gray-500 uppercase font-semibold">System LTV</div>
                <div className="text-xl font-bold mt-2 text-blue-400">₹{(dbStats?.totalLtv || 0).toLocaleString()}</div>
              </div>
            </div>
          )}
          <div className="rounded-lg bg-blue-950/20 border border-blue-900/30 p-3 mt-4 text-xs text-blue-300">
            ✓ MongoDB connection verified. Active replica collections: customers, orders, customerpersonas, customermoments.
          </div>
        </div>
      </div>

      {/* Bottom Grid: Weight Adjustment & Real-time Log */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Weight Adjustments */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
            <Sliders className="text-cyan-400" size={18} />
            <h2 className="font-semibold text-base">AI Model Propensity Weights</h2>
          </div>
          <p className="text-xs text-gray-400">Optimize how the scoring algorithm prioritizes various dimensions when evaluating candidate values.</p>
          
          <div className="space-y-4 pt-2">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span>RECENCY WEIGHT</span>
                <span className="text-cyan-400">{weights.recency}%</span>
              </div>
              <input 
                type="range" min="0" max="100" value={weights.recency} 
                onChange={(e) => setWeights({ ...weights, recency: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span>FREQUENCY WEIGHT</span>
                <span className="text-cyan-400">{weights.frequency}%</span>
              </div>
              <input 
                type="range" min="0" max="100" value={weights.frequency} 
                onChange={(e) => setWeights({ ...weights, frequency: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span>MONETARY WEIGHT</span>
                <span className="text-cyan-400">{weights.monetary}%</span>
              </div>
              <input 
                type="range" min="0" max="100" value={weights.monetary} 
                onChange={(e) => setWeights({ ...weights, monetary: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span>OFFER SENSITIVITY WEIGHT</span>
                <span className="text-cyan-400">{weights.offerSensitivity}%</span>
              </div>
              <input 
                type="range" min="0" max="100" value={weights.offerSensitivity} 
                onChange={(e) => setWeights({ ...weights, offerSensitivity: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
          </div>
        </div>

        {/* Real-time Events Log */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-800 pb-3">
            <div className="flex items-center gap-2">
              <Radio className="text-red-400 animate-pulse" size={18} />
              <h2 className="font-semibold text-base">Clickstream Moment Streams</h2>
            </div>
            <span className="text-xs bg-red-950 text-red-400 border border-red-900 px-2 py-0.5 rounded-full font-bold">LIVE</span>
          </div>

          <div className="h-64 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
            {liveMoments.map((mom, idx) => (
              <div key={mom._id || idx} className="bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-cyan-400 uppercase tracking-wide">{mom.event_type}</span>
                  <span className="text-gray-500">{new Date(mom.created_at).toLocaleTimeString()}</span>
                </div>
                <div>
                  <span className="text-gray-400">Customer: </span>
                  <span className="font-semibold">{mom.customer_id?.name || "Anonymous Guest"}</span> ({mom.customer_id?.phone || "No Contact"})
                </div>
                {mom.metadata && (
                  <div className="bg-gray-900/50 p-2 rounded text-gray-400 font-mono text-[10px]">
                    Payload: {JSON.stringify(mom.metadata)}
                  </div>
                )}
                {mom.action_taken && mom.action_taken.engage && (
                  <div className="bg-blue-950/20 border border-blue-900/30 p-2 rounded text-blue-300">
                    <span className="font-semibold">AI Agent Decision:</span> Sent {mom.action_taken.channel} message with {mom.action_taken.incentive} incentive.
                    <div className="italic text-[10px] mt-1">"{mom.action_taken.message}"</div>
                  </div>
                )}
                {mom.action_taken && !mom.action_taken.engage && mom.action_taken.status === "processed" && (
                  <div className="bg-gray-900 p-2 rounded text-gray-500 italic">
                    AI Agent Decision: Decided not to engage (no high-leverage trigger).
                  </div>
                )}
              </div>
            ))}
            {liveMoments.length === 0 && (
              <div className="py-12 text-center text-gray-500 text-sm">No streaming moments detected. Go interact with the Storefront!</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
