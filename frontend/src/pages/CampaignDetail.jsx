import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { campaignsApi } from "../services/api";
import socket from "../services/socket";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";

const FUNNEL_COLORS = ["#a855f7", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

const STAGES = ["sent", "delivered", "opened", "clicked", "converted"];

const STAGE_META = {
  sent:      { label: "Sent",      icon: "📨", color: "blue",  bg: "bg-blue-900/40",  text: "text-blue-300",  border: "border-blue-700/40" },
  delivered: { label: "Delivered", icon: "📥", color: "blue",    bg: "bg-blue-900/40",    text: "text-blue-300",    border: "border-blue-700/40" },
  opened:    { label: "Opened",    icon: "📖", color: "cyan",    bg: "bg-cyan-900/40",    text: "text-cyan-300",    border: "border-cyan-700/40" },
  clicked:   { label: "Clicked",   icon: "🔗", color: "amber",   bg: "bg-amber-900/40",   text: "text-amber-300",   border: "border-amber-700/40" },
  converted: { label: "Purchased", icon: "🛍️", color: "emerald", bg: "bg-emerald-900/40", text: "text-emerald-300", border: "border-emerald-700/40" },
  failed:    { label: "Failed",    icon: "⚠️", color: "red",     bg: "bg-red-900/40",     text: "text-red-300",     border: "border-red-700/40" },
};

// Animated counter hook
function useCounter(target, duration = 600) {
  const [count, setCount] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    if (target === prev.current) return;
    const diff = target - prev.current;
    const steps = 20;
    const stepVal = diff / steps;
    let current = prev.current;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      current += stepVal;
      setCount(step >= steps ? target : Math.round(current));
      if (step >= steps) {
        clearInterval(timer);
        prev.current = target;
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

// Live Funnel Counter Card
function FunnelStat({ label, value, color, icon }) {
  const animated = useCounter(value || 0);
  return (
    <div className={`flex flex-col items-center justify-center p-4 rounded-xl border ${color.border} ${color.bg} gap-1`}>
      <span className="text-2xl">{icon}</span>
      <p className={`text-2xl font-black ${color.text} tabular-nums`}>{animated}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
    </div>
  );
}

// Lifecycle stepper for a single log row
function LifecycleStepper({ status }) {
  const currentIdx = STAGES.indexOf(status === "failed" ? "sent" : status);
  return (
    <div className="flex items-center w-full gap-0">
      {STAGES.map((stage, i) => {
        const meta = STAGE_META[stage];
        const active = currentIdx >= i;
        const isCurrent = currentIdx === i;
        return (
          <React.Fragment key={stage}>
            <div className="flex flex-col items-center flex-1 min-w-0">
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[13px] transition-all duration-500
                ${active
                  ? `border-${meta.color}-500 bg-${meta.color}-950/60 shadow-[0_0_10px_rgba(0,0,0,0.3)] scale-110`
                  : "border-gray-800 bg-gray-900/40 opacity-40"
                } ${isCurrent ? "ring-2 ring-offset-1 ring-offset-gray-900 ring-" + meta.color + "-500/60" : ""}`}
              >
                <span>{meta.icon}</span>
              </div>
              <span className={`text-[8px] font-bold mt-1 uppercase tracking-wider truncate w-full text-center
                ${active ? "text-gray-300" : "text-gray-700"}`}>
                {meta.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`h-[2px] flex-1 mx-0.5 rounded-full transition-all duration-700 mt-[-12px]
                ${currentIdx > i ? "bg-gradient-to-r from-blue-600 to-blue-500" : "bg-gray-800"}`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function CampaignDetail() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  // Live per-communication status map: { [commId]: status }
  const [liveStatuses, setLiveStatuses] = useState({});
  // Flash-highlight newly updated rows
  const [flashIds, setFlashIds] = useState({});

  const reloadAnalytics = () =>
    campaignsApi.getAnalytics(id).then((r) => setAnalytics(r.data));

  useEffect(() => {
    campaignsApi.get(id).then((r) => setCampaign(r.data));
    reloadAnalytics();

    const handleCampaignUpdated = (updatedCampaign) => {
      if (String(updatedCampaign._id) === id) {
        setCampaign(updatedCampaign);
        reloadAnalytics();
      }
    };

    const handleCommStatusUpdated = (data) => {
      const commId = String(data.communication_id);
      const newStatus = data.status;

      // Always update live status map by commId (it belongs to us if it's in our logs)
      setLiveStatuses((prev) => ({ ...prev, [commId]: newStatus }));

      // Flash the row
      setFlashIds((prev) => ({ ...prev, [commId]: true }));
      setTimeout(() => {
        setFlashIds((prev) => {
          const copy = { ...prev };
          delete copy[commId];
          return copy;
        });
      }, 1500);

      // Reload analytics funnel numbers if it belongs to this campaign
      if (!data.campaign_id || data.campaign_id === id) {
        setTimeout(reloadAnalytics, 300);
      }
    };

    socket.on("campaign:updated", handleCampaignUpdated);
    socket.on("communication:status_updated", handleCommStatusUpdated);
    socket.on("communication:updated", (data) => {
      if (data.campaign_id === id) reloadAnalytics();
    });

    return () => {
      socket.off("campaign:updated", handleCampaignUpdated);
      socket.off("communication:status_updated", handleCommStatusUpdated);
      socket.off("communication:updated");
    };
  }, [id]);

  if (!campaign) return (
    <div className="p-6 flex items-center gap-3 text-gray-400">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      Loading campaign...
    </div>
  );

  const funnel = analytics?.funnel || {};
  const funnelData = [
    { name: "Sent",      value: funnel.sent      || 0 },
    { name: "Delivered", value: funnel.delivered  || 0 },
    { name: "Opened",    value: funnel.opened     || 0 },
    { name: "Clicked",   value: funnel.clicked    || 0 },
    { name: "Converted", value: funnel.converted  || 0 },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{campaign.name}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-400 flex-wrap">
            <span className="capitalize">{campaign.goal}</span>
            <span>·</span>
            <span>{campaign.channel}</span>
            <span>·</span>
            <span className={`capitalize font-semibold ${
              campaign.status === "active" ? "text-emerald-400" :
              campaign.status === "completed" ? "text-blue-400" : "text-gray-400"
            }`}>{campaign.status}</span>
            {campaign.created_by_agent && (
              <span className="badge bg-brand-900/40 text-brand-300 border border-brand-700/30">AI Generated</span>
            )}
          </div>
        </div>
        {/* Live indicator & Actions */}
        <div className="flex items-center gap-3">
          {campaign.status === "draft" && (
            <button
              onClick={async () => {
                try {
                  await campaignsApi.send(campaign._id);
                  // Socket will handle the UI update
                } catch (e) {
                  alert(e.response?.data?.error || "Failed to send campaign");
                }
              }}
              className="btn-primary py-1.5 px-4 bg-blue-600 hover:bg-blue-500 flex items-center gap-2 font-bold shadow-[0_0_15px_rgba(168,85,247,0.4)]"
            >
              🚀 Send Campaign Now
            </button>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/20 border border-emerald-900/40 rounded-xl">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Live Sync</span>
          </div>
        </div>
      </div>

      {/* ── Live Activity Feed ── */}
      <div className="card border border-blue-900/20 bg-gradient-to-br from-gray-900/80 to-blue-950/5">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h2 className="font-bold text-white text-base flex items-center gap-2">
              ⚡ Live Campaign Activity
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Updates in real time as customers interact in the Simulation Center
            </p>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[
              { label: "Sent",      value: funnel.sent      || 0, icon: "📨", bg: "bg-blue-900/30",  text: "text-blue-300",  border: "border-blue-800/30" },
              { label: "Delivered", value: funnel.delivered  || 0, icon: "📥", bg: "bg-blue-900/30",    text: "text-blue-300",    border: "border-blue-800/30" },
              { label: "Opened",    value: funnel.opened     || 0, icon: "📖", bg: "bg-cyan-900/30",    text: "text-cyan-300",    border: "border-cyan-800/30" },
              { label: "Clicked",   value: funnel.clicked    || 0, icon: "🔗", bg: "bg-amber-900/30",   text: "text-amber-300",   border: "border-amber-800/30" },
              { label: "Purchased", value: funnel.converted  || 0, icon: "🛍️", bg: "bg-emerald-900/30", text: "text-emerald-300", border: "border-emerald-800/30" },
            ].map(({ label, value, icon, bg, text, border }) => (
              <FunnelStat key={label} label={label} value={value} icon={icon}
                color={{ bg, text, border }} />
            ))}
          </div>
        </div>

        {/* Message Timeline */}
        {analytics?.logs?.length > 0 ? (
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {analytics.logs.map((log, idx) => {
              // Merge live status override
              const commId = log.communication_id;
              const effectiveStatus = commId && liveStatuses[commId]
                ? liveStatuses[commId]
                : log.status;
              const isFlashing = commId && flashIds[commId];
              const meta = STAGE_META[effectiveStatus] || STAGE_META.sent;

              return (
                <div
                  key={idx}
                  className={`rounded-xl border p-4 transition-all duration-500 ${
                    isFlashing
                      ? "border-blue-500/70 bg-blue-950/20 shadow-lg shadow-blue-950/30 scale-[1.01]"
                      : "border-gray-800/60 bg-gray-900/40 hover:border-gray-700/60"
                  }`}
                >
                  {/* Row header */}
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                        ${meta.bg} ${meta.text} border ${meta.border}`}>
                        {(log.customer_name || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm leading-none">{log.customer_name}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{log.customer_phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isFlashing && (
                        <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider animate-pulse">
                          ● Live update
                        </span>
                      )}
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border
                        ${meta.bg} ${meta.text} ${meta.border}`}>
                        {meta.icon} {meta.label}
                      </span>
                    </div>
                  </div>

                  {/* Lifecycle Stepper */}
                  <LifecycleStepper status={effectiveStatus} />

                  {/* Timestamps */}
                  <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-gray-800/60 text-[10px]">
                    <div>
                      <p className="text-gray-600 uppercase tracking-wide font-bold">Sent</p>
                      <p className="text-gray-400 mt-0.5 font-mono">
                        {log.sent_at ? new Date(log.sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-blue-700 uppercase tracking-wide font-bold">Delivered</p>
                      <p className={`mt-0.5 font-mono ${log.delivered_at ? "text-blue-400" : "text-gray-600"}`}>
                        {log.delivered_at ? new Date(log.delivered_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-cyan-700 uppercase tracking-wide font-bold">Opened</p>
                      <p className={`mt-0.5 font-mono ${log.opened_at ? "text-cyan-400" : "text-gray-600"}`}>
                        {log.opened_at ? new Date(log.opened_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-emerald-700 uppercase tracking-wide font-bold">Converted</p>
                      <p className={`mt-0.5 font-mono ${log.converted_at ? "text-emerald-400 font-bold" : "text-gray-600"}`}>
                        {log.converted_at ? new Date(log.converted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 border border-dashed border-gray-800 rounded-xl">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-gray-500 text-sm">No activity yet.</p>
            <p className="text-gray-600 text-xs mt-1">Send a campaign blast and interact in Simulation Center to see live updates here.</p>
          </div>
        )}
      </div>

      {/* ── Delivery Funnel Chart ── */}
      <div className="card">
        <h2 className="font-semibold text-white mb-4">Delivery Funnel</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={funnelData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 12 }} />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }}
              labelStyle={{ color: "#f9fafb" }}
            />
            <Bar dataKey="value" name="Count" fill="#a855f7" radius={[4, 4, 0, 0]}>
              {funnelData.map((_, i) => (
                <Cell key={i} fill={FUNNEL_COLORS[i]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="flex flex-wrap gap-6 mt-4 justify-center">
          {[
            { label: "Delivery Rate", val: funnel.delivered_rate },
            { label: "Open Rate",     val: funnel.open_rate },
            { label: "CTR",           val: funnel.ctr },
            { label: "Conversion",    val: funnel.conversion_rate },
          ].map(({ label, val }) => (
            <div key={label} className="text-center">
              <p className="text-xl font-bold text-white">{val ? `${val.toFixed(1)}%` : "—"}</p>
              <p className="text-xs text-gray-400">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Timing Metrics ── */}
      {analytics?.timing && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="card">
            <h2 className="font-semibold text-white mb-4">WhatsApp Delivery &amp; Open Speeds</h2>
            <div className="grid gap-4 grid-cols-2">
              <div className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-4 text-center">
                <p className="text-2xl font-black text-blue-400">
                  {formatDuration(analytics.timing.avg_delivery_time_seconds)}
                </p>
                <p className="text-xs text-gray-400 mt-1">Avg. Delivery Speed</p>
              </div>
              <div className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-4 text-center">
                <p className="text-2xl font-black text-blue-400">
                  {formatDuration(analytics.timing.avg_open_time_seconds)}
                </p>
                <p className="text-xs text-gray-400 mt-1">Avg. Open Delay</p>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold text-white mb-2">Conversion Rate by Open Delay</h2>
            <p className="text-xs text-gray-400 mb-4">How quickly a customer opens affects their conversion rate.</p>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={analytics.timing.open_delay_impact}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="slot" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                <YAxis unit="%" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }}
                  labelStyle={{ color: "#f9fafb" }}
                />
                <Bar dataKey="conversion_rate" name="Conversion Rate" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── AI Insights ── */}
      {analytics?.insights_text && (
        <div className="card bg-brand-900/20 border-brand-700/40">
          <h2 className="font-semibold text-brand-300 mb-2">AI Insights</h2>
          <p className="text-sm text-gray-300 whitespace-pre-line">{analytics.insights_text}</p>
        </div>
      )}

      {/* ── Copy Variants ── */}
      {campaign.copy_variants?.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Copy Variants</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {campaign.copy_variants.map((v) => (
              <div
                key={v.variant_id}
                className={`p-4 rounded-lg border ${
                  v.is_winner
                    ? "border-green-600/50 bg-green-900/10"
                    : "border-gray-700 bg-gray-800/50"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-white">Variant {v.variant_id}</span>
                  {v.is_winner && (
                    <span className="badge bg-green-900/50 text-green-300 border border-green-700/40">Winner</span>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-200">{v.headline}</p>
                <p className="text-sm text-gray-400 mt-1">{v.body}</p>
                <p className="text-xs text-brand-400 mt-2">CTA: {v.cta}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Resilience & DLQ Monitor ── */}
      <div className="card border border-blue-900/30 bg-blue-950/5 p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="font-semibold text-white text-base flex items-center gap-2">
              🛡️ High-Reliability Pipeline Monitor (DLQ)
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Active backoff retry configuration and Dead Letter Queue dashboard.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 px-2.5 py-1 rounded-full">
              HEALTHY // ACTIVE_RETRIES
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
            <p className="text-[10.5px] text-gray-500 uppercase font-bold tracking-wider">MAX_RETRIES</p>
            <p className="text-xl font-bold text-white mt-1">3 Attempts</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Exponential Backoff</p>
          </div>
          <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
            <p className="text-[10.5px] text-gray-500 uppercase font-bold tracking-wider">RETRY STATUS</p>
            <p className="text-xl font-bold text-cyan-400 mt-1">Automatic</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Callback Listener</p>
          </div>
          <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
            <p className="text-[10.5px] text-gray-500 uppercase font-bold tracking-wider">DEAD LETTER QUEUE</p>
            <p className="text-xl font-bold text-white mt-1">
              {funnel.failed || 0} <span className="text-xs font-normal text-gray-500">Failed msgs</span>
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${funnel.failed > 0 ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`} />
              <span className="text-[10.5px] text-gray-400">{funnel.failed > 0 ? "Requires action" : "Zero errors"}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between flex-wrap gap-2 text-xs">
          <span className="text-gray-500">
            * Retries are scheduled via webhook failures. After 3 failovers, messages transition to DLQ.
          </span>
          <button
            onClick={async () => {
              try {
                await campaignsApi.retryDLQ();
                alert("DLQ retry queue has been triggered successfully!");
                reloadAnalytics();
              } catch (err) {
                alert("Failed to trigger DLQ retry.");
              }
            }}
            className="px-4 py-2 bg-blue-800 hover:bg-blue-700 text-white rounded-lg font-bold transition-all shadow-md flex items-center gap-1.5"
          >
            🔄 Trigger Force DLQ Retry
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = (seconds / 3600).toFixed(1);
  return `${hrs}h`;
}
