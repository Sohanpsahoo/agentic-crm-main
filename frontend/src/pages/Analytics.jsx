import React, { useEffect, useState } from "react";
import { analyticsApi } from "../services/api";
import personasApi from "../services/personasApi";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  PieChart, Pie, Cell,
} from "recharts";
import {
  TrendingUp, MessageSquare, MousePointerClick, ShoppingBag,
  CheckCircle, Send, BarChart3, Radio, PieChart as PieIcon, DollarSign, Sparkles,
} from "lucide-react";

const FUNNEL_COLORS = ["#a855f7", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"];
const RFM_COLORS = {
  Champions: "#a855f7",
  Loyal: "#3b82f6",
  "At Risk": "#f59e0b",
  "Cannot Lose": "#ef4444",
  Lost: "#6b7280",
  New: "#06b6d4",
  Potential: "#10b981",
};

function KpiCard({ icon: Icon, label, value, sub, color = "purple" }) {
  const cm = {
    purple: "text-purple-400 bg-purple-600/20",
    green:  "text-green-400 bg-green-600/20",
    blue:   "text-blue-400 bg-blue-600/20",
    amber:  "text-amber-400 bg-amber-600/20",
    rose:   "text-rose-400 bg-rose-600/20",
    cyan:   "text-cyan-400 bg-cyan-600/20",
  }[color] || "text-purple-400 bg-purple-600/20";
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cm}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xl font-bold text-white">{value ?? "—"}</p>
        <p className="text-xs text-gray-400">{label}</p>
        {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, sub }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-8 h-8 rounded-lg bg-purple-600/20 flex items-center justify-center">
        <Icon size={16} className="text-purple-400" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {sub && <p className="text-xs text-gray-500">{sub}</p>}
      </div>
    </div>
  );
}

function FunnelStep({ label, value, rate, color, isFirst }) {
  const pct = Math.min(100, parseFloat(rate) || 0);
  return (
    <div className="flex items-center gap-3">
      {!isFirst && <div className="w-px h-6 bg-gray-600 ml-5" />}
      <div className="flex items-center gap-3 w-full">
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: color + "20", border: `1px solid ${color}40` }}>
          <span className="text-xs font-bold" style={{ color }}>{label[0]}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-300">{label}</span>
            <span className="text-sm font-bold text-white">{(value || 0).toLocaleString()}</span>
          </div>
          <div className="h-1.5 bg-gray-700 rounded-full">
            <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
          </div>
          <span className="text-xs text-gray-500 mt-0.5 block">{rate}% of sent</span>
        </div>
      </div>
    </div>
  );
}

const CUSTOM_TOOLTIP = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white">
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-bold">{typeof p.value === "number" ? p.value.toFixed(1) : p.value}%</span>
        </div>
      ))}
    </div>
  );
};

import { agentApi } from "../services/api";

export default function Analytics() {
  const [overview, setOverview] = useState(null);
  const [channelPerf, setChannelPerf] = useState([]);
  const [campaignPerf, setCampaignPerf] = useState([]);
  const [roi, setRoi] = useState([]);
  const [rfmDist, setRfmDist] = useState([]);
  const [aiInsight, setAiInsight] = useState("");
  const [loadingInsight, setLoadingInsight] = useState(false);

  useEffect(() => {
    analyticsApi.overview().then((r) => setOverview(r.data)).catch(() => {});
    analyticsApi.channelPerformance().then((r) => setChannelPerf(r.data)).catch(() => {});
    analyticsApi.campaigns({ days: 60 }).then((r) => setCampaignPerf(r.data.slice(0, 10))).catch(() => {});
    analyticsApi.roi().then((r) => setRoi(r.data.slice(0, 8))).catch(() => {});
    personasApi.distribution().catch(() => []).then((d) => setRfmDist(d || []));

    // Fetch AI Narrative Summary
    setLoadingInsight(true);
    agentApi.chat("Provide a 2-3 sentence narrative summary of our recent analytics performance and channel ROI. Just the summary, no formatting.", [], "Marketer")
      .then(res => setAiInsight(res.data?.reply))
      .catch(() => setAiInsight("AI Insights unavailable at the moment."))
      .finally(() => setLoadingInsight(false));
  }, []);

  const ov = overview || {};
  const sent = Number(ov.total_messages_sent) || 0;

  const funnelSteps = [
    { label: "Sent",      value: sent,                  rate: "100",                              color: "#a855f7" },
    { label: "Delivered", value: Number(ov.total_delivered) || 0, rate: ov.delivered_rate || "0", color: "#3b82f6" },
    { label: "Opened",    value: Number(ov.total_opened) || 0,    rate: ov.overall_open_rate || "0", color: "#10b981" },
    { label: "Clicked",   value: Number(ov.total_clicked) || 0,   rate: ov.overall_ctr || "0",    color: "#f59e0b" },
    { label: "Converted", value: Number(ov.total_converted) || 0, rate: ov.overall_conversion_rate || "0", color: "#ef4444" },
  ];

  const radarData = channelPerf.map((c) => ({
    channel: c.channel?.toUpperCase() || "—",
    "Open Rate": parseFloat(c.open_rate?.toFixed(1) || 0),
    "CTR": parseFloat(c.ctr?.toFixed(1) || 0),
    "Conv Rate": parseFloat(c.conversion_rate?.toFixed(1) || 0),
  }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-gray-400 text-sm mt-0.5">Cross-campaign performance intelligence</p>
      </div>

      {/* AI Narrative Insights */}
      <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/20 border border-purple-800/40 rounded-xl p-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-500 to-blue-500" />
        <div className="flex gap-4 items-start relative z-10">
          <div className="w-10 h-10 rounded-full bg-purple-950/80 border border-purple-800 flex items-center justify-center flex-shrink-0">
            <Sparkles size={18} className="text-purple-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-purple-300 mb-1">Copilot Insights</h2>
            {loadingInsight ? (
              <div className="animate-pulse flex gap-2 items-center text-sm text-purple-200/60 mt-2">
                <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                Synthesizing performance data...
              </div>
            ) : (
              <p className="text-sm text-purple-100 leading-relaxed max-w-4xl">
                {aiInsight}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Overview KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard icon={Send}              label="Messages Sent"    value={sent.toLocaleString()}              color="purple" />
        <KpiCard icon={CheckCircle}       label="Delivered"        value={`${ov.delivered_rate ?? 0}%`}       color="blue"   sub={`${(ov.total_delivered || 0).toLocaleString()} msgs`} />
        <KpiCard icon={MessageSquare}     label="Open Rate"        value={`${ov.overall_open_rate ?? 0}%`}    color="green"  sub={`${(ov.total_opened || 0).toLocaleString()} opened`} />
        <KpiCard icon={MousePointerClick} label="Click Rate (CTR)" value={`${ov.overall_ctr ?? 0}%`}         color="amber"  sub={`${(ov.total_clicked || 0).toLocaleString()} clicked`} />
        <KpiCard icon={ShoppingBag}       label="Conversion Rate"  value={`${ov.overall_conversion_rate ?? 0}%`} color="rose" sub={`${(ov.total_converted || 0).toLocaleString()} converted`} />
      </div>

      {/* Funnel + Channel Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Delivery Funnel */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <SectionHeader icon={BarChart3} title="Campaign Delivery Funnel" sub="All campaigns — cumulative" />
          {sent > 0 ? (
            <div className="space-y-3 mt-2">
              {funnelSteps.map((s, i) => (
                <FunnelStep key={s.label} {...s} isFirst={i === 0} />
              ))}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
              No message data — run an AI campaign to see funnel
            </div>
          )}
        </div>

        {/* Channel Performance Radar */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <SectionHeader icon={Radio} title="Channel Performance" sub="Open rate · CTR · Conversion by channel" />
          {radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#374151" />
                <PolarAngleAxis dataKey="channel" tick={{ fill: "#9ca3af", fontSize: 12 }} />
                <Radar name="Open Rate %" dataKey="Open Rate" stroke="#a855f7" fill="#a855f7" fillOpacity={0.2} />
                <Radar name="CTR %"       dataKey="CTR"       stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                <Radar name="Conv %"      dataKey="Conv Rate" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-56 flex items-center justify-center text-gray-500 text-sm">No channel data</div>
          )}
        </div>
      </div>

      {/* Campaign performance bar */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
        <SectionHeader icon={BarChart3} title="Campaign Performance" sub="Top campaigns by open rate (last 60 days)" />
        {campaignPerf.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={campaignPerf} layout="vertical" margin={{ left: 120, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 11 }} unit="%" />
              <YAxis type="category" dataKey="campaign_name" tick={{ fill: "#9ca3af", fontSize: 10 }} width={120} />
              <Tooltip content={<CUSTOM_TOOLTIP />} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
              <Bar dataKey="open_rate"       name="Open Rate %"  fill="#a855f7" radius={[0, 3, 3, 0]} />
              <Bar dataKey="ctr"             name="CTR %"        fill="#3b82f6" radius={[0, 3, 3, 0]} />
              <Bar dataKey="conversion_rate" name="Conv Rate %"  fill="#10b981" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-40 flex items-center justify-center text-gray-500 text-sm">No campaign data</div>
        )}
      </div>

      {/* ROI + RFM Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ROI per campaign */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <SectionHeader icon={DollarSign} title="Campaign ROI" sub="Revenue attributed vs estimated cost" />
          {roi.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-xs text-gray-400 uppercase">
                    <th className="text-left py-2 pr-3">Campaign</th>
                    <th className="text-right py-2 px-2">Sent</th>
                    <th className="text-right py-2 px-2">Revenue</th>
                    <th className="text-right py-2 px-2">Cost</th>
                    <th className="text-right py-2">ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {roi.map((r, i) => (
                    <tr key={i} className="border-b border-gray-700/40 hover:bg-gray-700/20">
                      <td className="py-2 pr-3 text-white truncate max-w-28">{r.campaign_name || "—"}</td>
                      <td className="py-2 px-2 text-right text-gray-400">{r.sent?.toLocaleString()}</td>
                      <td className="py-2 px-2 text-right text-green-400">₹{(r.revenue_attributed || 0).toLocaleString()}</td>
                      <td className="py-2 px-2 text-right text-gray-400">₹{(r.estimated_cost || 0).toFixed(0)}</td>
                      <td className="py-2 text-right">
                        <span className={`font-bold ${(r.roi || 0) >= 1 ? "text-green-400" : "text-red-400"}`}>
                          {(r.roi || 0).toFixed(1)}x
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-500 text-sm">
              No ROI data — conversions drive this metric
            </div>
          )}
        </div>

        {/* RFM Segment Distribution */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <SectionHeader icon={PieIcon} title="RFM Segment Distribution" sub="Customer segments by recency · frequency · monetary" />
          {rfmDist.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={220}>
                <PieChart>
                  <Pie
                    data={rfmDist}
                    dataKey="count"
                    nameKey="segment"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {rfmDist.map((entry) => (
                      <Cell key={entry.segment} fill={RFM_COLORS[entry.segment] || "#6b7280"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
                    formatter={(v, n) => [`${v} customers`, n]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {rfmDist.map((d) => (
                  <div key={d.segment} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: RFM_COLORS[d.segment] || "#6b7280" }} />
                    <span className="text-gray-300 flex-1">{d.segment}</span>
                    <span className="text-gray-400 font-medium">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-500 text-sm">
              No RFM data — click "Recompute RFM" on the Personas page
            </div>
          )}
        </div>
      </div>

      {/* Channel performance table */}
      {channelPerf.length > 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <SectionHeader icon={Radio} title="Channel Breakdown" sub="Per-channel delivery stats" />
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-xs text-gray-400 uppercase">
                {["Channel", "Messages", "Open Rate", "CTR", "Conversion"].map((h) => (
                  <th key={h} className="text-left py-2 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {channelPerf.map((c) => (
                <tr key={c.channel} className="border-b border-gray-700/40 hover:bg-gray-700/20">
                  <td className="py-2.5 pr-4">
                    <span className="capitalize font-medium text-white">
                      {c.channel === "whatsapp" ? "💬" : c.channel === "email" ? "📧" : "📱"} {c.channel}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-gray-400">{(c.total || 0).toLocaleString()}</td>
                  <td className="py-2.5 pr-4">
                    <span className="text-purple-400 font-semibold">{parseFloat(c.open_rate || 0).toFixed(1)}%</span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className="text-blue-400 font-semibold">{parseFloat(c.ctr || 0).toFixed(1)}%</span>
                  </td>
                  <td className="py-2.5">
                    <span className="text-green-400 font-semibold">{parseFloat(c.conversion_rate || 0).toFixed(1)}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
