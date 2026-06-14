import React, { useEffect, useState } from "react";
import {
  Users, Megaphone, TrendingUp, MessageSquare, BarChart3, Zap, Target,
  Bot, Activity, Circle, RefreshCw, Cpu, GitBranch, Sparkles, CheckCircle,
  TrendingDown, ArrowUpRight, ArrowDownRight, Tag, HelpCircle, LayoutDashboard,
  MessageCircle, Mail, PieChart
} from "lucide-react";
import { analyticsApi, agentApi, segmentsApi } from "../services/api";
import personasApi from "../services/personasApi";
import socket from "../services/socket";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, PieChart as RechartsPie, Pie, Cell
} from "recharts";

// ─── KPI Card ──────────────────────────────────────────────────────────
function MockupKpiCard({ label, value, trend, isPositive }) {
  return (
    <div className="premium-card p-6 flex flex-col justify-between h-[126px]">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-medium text-zinc-400 tracking-tight">{label}</span>
        <span
          className={`flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${
            isPositive
              ? "text-emerald-400 bg-emerald-950/30"
              : "text-rose-400 bg-rose-950/30"
          }`}
        >
          {isPositive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
          {trend}
        </span>
      </div>
      <div className="text-[28px] font-bold text-white leading-none tracking-tight">
        {value}
      </div>
    </div>
  );
}

// ─── Agent status badge ───────────────────────────────────────────────────────
const STATUS_CONFIG = {
  live:   { dot: "bg-green-400",  ring: "ring-green-500/40",  badge: "text-green-400 bg-green-950/40",  label: "LIVE"  },
  idle:   { dot: "bg-amber-400",  ring: "ring-amber-500/40",  badge: "text-amber-400 bg-amber-950/40",  label: "IDLE"  },
  ready:  { dot: "bg-gray-400",   ring: "ring-gray-500/20",   badge: "text-zinc-400 bg-zinc-900/50",    label: "READY" },
};

const AGENT_ICONS = {
  supervisor:         Sparkles,
  segmentation:       PieChart,
  campaign_creation:  Megaphone,
  personalization:    MessageSquare,
  channel_selection:  Zap,
  execution:          Zap,
  analytics:          BarChart3,
  optimization:       TrendingUp,
  journey_builder:    GitBranch,
  human_approval:     CheckCircle,
};

function AgentCard({ agent }) {
  const cfg = STATUS_CONFIG[agent.status] || STATUS_CONFIG.ready;
  const Icon = AGENT_ICONS[agent.id] || Bot;

  return (
    <div className="bg-zinc-950 rounded-2xl border border-[#18181b] p-4 transition-all duration-300 hover:shadow-sm flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="w-8 h-8 rounded-xl bg-blue-950/40 flex items-center justify-center flex-shrink-0">
          <Icon size={16} className="text-blue-400" />
        </div>
        <span className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
          {agent.status === "live" ? (
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
            </span>
          ) : (
            <Circle size={4} className="fill-current" />
          )}
          {cfg.label}
        </span>
      </div>
      <div>
        <p className="text-[13px] font-bold text-white leading-tight">{agent.label}</p>
        <p className="text-[11px] text-zinc-450 mt-0.5 leading-tight">{agent.role}</p>
      </div>
    </div>
  );
}

// ─── Agent Fleet Panel ────────────────────────────────────────────────────────
function AgentFleetPanel() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = () => {
    agentApi.stats()
      .then((r) => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10_000);
    return () => clearInterval(interval);
  }, []);

  const liveCount   = stats?.live_agents   ?? 0;
  const idleCount   = stats?.idle_agents   ?? 0;
  const readyCount  = stats?.ready_agents  ?? 0;
  const totalCount  = stats?.total_agents  ?? 10;

  return (
    <div className="premium-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-950/40 flex items-center justify-center">
            <Cpu size={20} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-[16px] font-bold text-white">AI Agent Fleet Status</h2>
            <p className="text-[12px] text-zinc-400">LangGraph Multi-Agent Engine</p>
          </div>
        </div>
        <button
          onClick={fetchStats}
          className="text-zinc-500 hover:text-zinc-300 transition-colors p-2 rounded-xl hover:bg-zinc-900"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-zinc-950 rounded-xl p-3.5 text-center border border-[#18181b]">
          <p className="text-2xl font-bold text-white">{totalCount}</p>
          <p className="text-[11px] text-zinc-550 mt-0.5">Total Agents</p>
        </div>
        <div className="bg-emerald-950/20 rounded-xl p-3.5 text-center border border-emerald-900/30">
          <p className="text-2xl font-bold text-emerald-450">{liveCount}</p>
          <p className="text-[11px] text-emerald-400 mt-0.5 font-semibold">Live Now</p>
        </div>
        <div className="bg-amber-950/20 rounded-xl p-3.5 text-center border border-amber-900/30">
          <p className="text-2xl font-bold text-amber-450">{idleCount}</p>
          <p className="text-[11px] text-amber-400 mt-0.5">Idle</p>
        </div>
        <div className="bg-zinc-950 rounded-xl p-3.5 text-center border border-[#18181b]">
          <p className="text-2xl font-bold text-zinc-400">{readyCount}</p>
          <p className="text-[11px] text-zinc-550 mt-0.5">Ready</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-zinc-900 rounded-xl h-24 animate-pulse border border-[#18181b]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(stats?.agents ?? []).slice(0, 10).map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}

const RFM_COLORS = {
  Champions: "#a78bfa", Loyal: "#3b82f6", "At Risk": "#f59e0b",
  "Cannot Lose": "#ef4444", Lost: "#6b7280", New: "#06b6d4", Potential: "#10b981",
};

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [campaignPerf, setCampaignPerf] = useState([]);
  const [rfmDist, setRfmDist] = useState([]);
  const [suggestedSegments, setSuggestedSegments] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);

  useEffect(() => {
    analyticsApi.overview().then((r) => setOverview(r.data)).catch(() => {});
    analyticsApi.campaigns({ days: 30 }).then((r) => setCampaignPerf(r.data.slice(0, 8))).catch(() => {});
    personasApi.distribution().then((d) => setRfmDist(d || [])).catch(() => {});
    
    // Fetch Suggested Segments
    agentApi.chat("Generate 4 target segment recommendations based on recent activity: 'Dormant High Value Customers', 'Frequent Buyers This Month', 'First Purchase Users', and 'At Risk Customers'. Return EXACTLY a JSON array of objects with keys: 'name', 'reason', 'action'. Do not return markdown. Just the raw JSON array.", [], "Marketer")
      .then(res => {
        try {
           const match = res.data.reply.match(/\[.*\]/s);
           if (match) {
             setSuggestedSegments(JSON.parse(match[0]));
           } else {
             setSuggestedSegments(JSON.parse(res.data.reply));
           }
        } catch(e) {
           throw e; // trigger catch block
        }
      })
      .catch((e) => {
         setSuggestedSegments([
           { name: "Dormant High Value Customers", reason: "High LTV customers who haven't made a purchase in 60 days.", action: "Win-back Offer" },
           { name: "Frequent Buyers This Month", reason: "Highly engaged users with 3+ purchases in the last 30 days.", action: "Loyalty Reward" },
           { name: "First Purchase Users", reason: "Newly acquired customers who made their first purchase recently.", action: "Onboarding Flow" },
           { name: "At Risk Customers", reason: "Declining engagement and purchase frequency over the last 3 months.", action: "Check-in Campaign" }
         ]);
      })
      .finally(() => setLoadingSuggestions(false));
  }, []);

  useEffect(() => {
    const handleCustomerUpdated = () => {
      analyticsApi.overview().then((r) => setOverview(r.data)).catch(() => {});
      personasApi.distribution().then((d) => setRfmDist(d || [])).catch(() => {});
    };
    socket.on("customer:updated", handleCustomerUpdated);
    return () => {
      socket.off("customer:updated", handleCustomerUpdated);
    };
  }, []);

  const growthData = [
    { name: "Jan", revenue: 3.2 },
    { name: "Feb", revenue: 4.9 },
    { name: "Mar", revenue: 5.6 },
    { name: "Apr", revenue: 7.8 },
    { name: "May", revenue: 8.4 },
    { name: "Jun", revenue: 11.2 },
  ];

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-12">
      {/* Title */}
      <div>
        <h1 className="text-[32px] font-bold text-white tracking-tight">Executive Dashboard</h1>
      </div>

      {/* Main Grid: 1:1 to mockup layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: 4 KPI Cards + Recent Activity Feed */}
        <div className="lg:col-span-7 space-y-8">
          {/* 4 KPI cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <MockupKpiCard
              label="Total Revenue"
              value={overview?.total_revenue ? `₹${overview.total_revenue.toLocaleString()}` : "$1,250,000"}
              trend="+12%"
              isPositive={true}
            />
            <MockupKpiCard
              label="Active Customers"
              value={overview?.total_customers ? overview.total_customers.toLocaleString() : "850"}
              trend="+5%"
              isPositive={true}
            />
            <MockupKpiCard
              label="Avg. Deal Size"
              value="₹14,700"
              trend="+2%"
              isPositive={true}
            />
            <MockupKpiCard
              label="Churn Rate"
              value="1.5%"
              trend="-0.5%"
              isPositive={true}
            />
          </div>

          {/* AI Suggested Segments Card */}
          <div className="bg-gradient-to-br from-blue-900/20 to-blue-900/10 border border-blue-800/30 p-6 rounded-2xl relative overflow-hidden">
             <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-blue-500" />
             <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-blue-900/40 flex items-center justify-center">
                   <Target size={16} className="text-blue-400" />
                </div>
                <div>
                   <h2 className="text-[16px] font-bold text-white">AI Suggested Segments</h2>
                   <p className="text-[11px] text-blue-300/70">Copilot recommendations for this week</p>
                </div>
             </div>
             
             {loadingSuggestions ? (
                <div className="flex flex-col gap-3">
                   <div className="h-16 bg-blue-950/20 rounded-xl animate-pulse border border-blue-900/20" />
                   <div className="h-16 bg-blue-950/20 rounded-xl animate-pulse border border-blue-900/20" />
                   <div className="h-16 bg-blue-950/20 rounded-xl animate-pulse border border-blue-900/20" />
                </div>
             ) : (
                <div className="flex flex-col gap-3">
                   {suggestedSegments.map((seg, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3.5 bg-zinc-950/60 rounded-xl border border-blue-900/20 hover:border-blue-500/50 transition-colors group">
                         <div>
                            <p className="text-[14px] font-bold text-white group-hover:text-blue-300 transition-colors">{seg.name}</p>
                            <p className="text-[11px] text-zinc-400 mt-0.5">{seg.reason}</p>
                         </div>
                         <button className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-300 hover:bg-blue-600 hover:text-white transition-all flex-shrink-0 flex items-center gap-1.5">
                            <Bot size={12} /> {seg.action}
                         </button>
                      </div>
                   ))}
                </div>
             )}
          </div>

          {/* Recent Activity Feed Card */}
          <div className="premium-card p-6">
            <h2 className="text-[16px] font-bold text-white mb-6">Recent Activity Feed</h2>
            <div className="space-y-4">
              {/* Item 1 */}
              <div className="flex items-center justify-between p-4 bg-zinc-950/40 rounded-2xl border border-[#18181b]/60 hover:shadow-sm transition-all duration-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-zinc-800 shadow-sm flex-shrink-0">
                    <img
                      src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&h=100&q=80"
                      alt="User avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-[14px] font-semibold text-zinc-300">New deal signed: Acme Corp for $50k</span>
                </div>
                <span className="text-[12px] text-zinc-500 whitespace-nowrap ml-4">1 hr ago</span>
              </div>

              {/* Item 2 */}
              <div className="flex items-center justify-between p-4 bg-zinc-950/40 rounded-2xl border border-[#18181b]/60 hover:shadow-sm transition-all duration-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-zinc-800 shadow-sm flex-shrink-0">
                    <img
                      src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80"
                      alt="User avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-[14px] font-semibold text-zinc-300">Customer support ticket closed: #2345</span>
                </div>
                <span className="text-[12px] text-zinc-500 whitespace-nowrap ml-4">3 hrs ago</span>
              </div>

              {/* Item 3 */}
              <div className="flex items-center justify-between p-4 bg-zinc-950/40 rounded-2xl border border-[#18181b]/60 hover:shadow-sm transition-all duration-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-950/30 flex items-center justify-center flex-shrink-0">
                    <Megaphone size={16} className="text-blue-400" />
                  </div>
                  <span className="text-[14px] font-semibold text-zinc-300">Marketing campaign "Summer Sale" launched</span>
                </div>
                <span className="text-[12px] text-zinc-500 whitespace-nowrap ml-4">5 hrs ago</span>
              </div>

              {/* Item 4 */}
              <div className="flex items-center justify-between p-4 bg-zinc-950/40 rounded-2xl border border-[#18181b]/60 hover:shadow-sm transition-all duration-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-950/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle size={16} className="text-emerald-450" />
                  </div>
                  <span className="text-[14px] font-semibold text-zinc-300">Lead converted: John Smith</span>
                </div>
                <span className="text-[12px] text-zinc-500 whitespace-nowrap ml-4">1 day ago</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Tall Revenue Growth Card */}
        <div className="lg:col-span-5 h-full">
          <div className="premium-card p-6 flex flex-col h-full min-h-[512px] justify-between">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-[16px] font-bold text-white">Revenue Growth (Last 6 Months)</h2>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">YTD</span>
                <span className="text-[20px] font-extrabold text-white">$7.5M</span>
              </div>
            </div>

            <div className="flex-1 min-h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={growthData}
                  margin={{ top: 10, right: 10, left: -22, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.24} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#18181b" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#71717a", fontSize: 13, fontWeight: 500 }}
                  />
                  <YAxis
                    domain={[0, 12]}
                    ticks={[0, 2, 4, 6, 8, 10, 12]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#71717a", fontSize: 13, fontWeight: 500 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#09090B",
                      border: "1px solid #18181b",
                      borderRadius: "16px",
                      boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
                    }}
                    labelStyle={{ fontWeight: "bold", color: "#020202" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#a78bfa"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Fold Separator */}
      <div className="border-t border-[#18181b] my-8" />

      {/* Below the Fold Details: Fleet Panel & RFM distribution */}
      <div className="grid grid-cols-1 gap-8">
        {/* Fleet Monitor */}
        <AgentFleetPanel />

        {/* Campaign performance chart and RFM metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="premium-card p-6">
            <h2 className="text-[16px] font-bold text-white mb-6">Campaign Conversion Analysis (Last 30 Days)</h2>
            {campaignPerf.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={campaignPerf} margin={{ top: 0, right: 10, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#18181b" />
                  <XAxis
                    dataKey="campaign_name"
                    tick={{ fill: "#a1a1aa", fontSize: 11 }}
                    angle={-20}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} unit="%" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#09090B", border: "1px solid #18181b", borderRadius: 12 }}
                  />
                  <Legend />
                  <Bar dataKey="open_rate" name="Open Rate %" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ctr"       name="CTR %"       fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="conversion_rate" name="Conv %" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-56 flex items-center justify-center text-zinc-500 text-sm">
                No active campaign analytics available. Run a campaign to populate details.
              </div>
            )}
          </div>

          <div className="premium-card p-6">
            <h2 className="text-[16px] font-bold text-white mb-6">RFM Customer Segments</h2>
            {rfmDist.length > 0 ? (
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <ResponsiveContainer width={200} height={180}>
                  <RechartsPie>
                    <Pie data={rfmDist} dataKey="count" nameKey="segment" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3}>
                      {rfmDist.map((d) => <Cell key={d.segment} fill={RFM_COLORS[d.segment] || "#6b7280"} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: "#09090B", border: "1px solid #18181b", borderRadius: 12, fontSize: 12 }}
                      formatter={(v, n) => [`${v} customers`, n]}
                    />
                  </RechartsPie>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 flex-1">
                  {rfmDist.map((d) => (
                    <div key={d.segment} className="flex items-center gap-2 text-[13px]">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: RFM_COLORS[d.segment] || "#6b7280" }} />
                      <span className="text-zinc-400 flex-1">{d.segment}</span>
                      <span className="text-white font-bold">{d.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-44 flex items-center justify-center text-zinc-500 text-sm">
                Segment calculation in progress...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
