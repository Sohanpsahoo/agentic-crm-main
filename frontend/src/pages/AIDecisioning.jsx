import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Zap, TrendingUp, Radio, Target, RefreshCw, ChevronUp, ChevronDown, Minus } from "lucide-react";
import personasApi from "../services/personasApi";

const URGENCY_STYLES = {
  high:   "text-red-400 bg-red-400/10 border-red-400/20",
  medium: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  low:    "text-green-400 bg-green-400/10 border-green-400/20",
};

const ACTION_STYLES = {
  "re-engage": "text-orange-400 bg-orange-400/10",
  winback:     "text-red-400 bg-red-400/10",
  upsell:      "text-blue-400 bg-blue-400/10",
  retain:      "text-blue-400 bg-blue-400/10",
  nurture:     "text-green-400 bg-green-400/10",
};

const CHANNEL_ICONS = { whatsapp: "💬", email: "📧", sms: "📱" };

const ACTIONS = ["", "re-engage", "winback", "upsell", "retain", "nurture"];

function ScoreBar({ value, max = 100, color = "bg-blue-500" }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-700 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-8 text-right">{value}</span>
    </div>
  );
}

function ChannelAffinityBar({ affinity }) {
  const ch = [
    { key: "whatsapp", icon: "💬", val: affinity?.whatsapp ?? 0 },
    { key: "email",    icon: "📧", val: affinity?.email ?? 0 },
    { key: "sms",      icon: "📱", val: affinity?.sms ?? 0 },
  ];
  const best = ch.reduce((a, b) => (b.val > a.val ? b : a));
  return (
    <div className="flex gap-2">
      {ch.map((c) => (
        <div key={c.key} className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${
          c.key === best.key ? "bg-blue-600/30 text-blue-300" : "bg-gray-700 text-gray-400"
        }`}>
          <span>{c.icon}</span>
          <span>{Math.round(c.val * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

function UrgencyIcon({ urgency }) {
  if (urgency === "high")   return <ChevronUp size={14} className="text-red-400" />;
  if (urgency === "low")    return <ChevronDown size={14} className="text-green-400" />;
  return <Minus size={14} className="text-amber-400" />;
}

export default function AIDecisioning() {
  const queryClient = useQueryClient();
  const [actionFilter, setActionFilter] = useState("");

  const { data: decisions = [], isLoading: loadingDecisions } = useQuery({
    queryKey: ["ai-decisions", actionFilter],
    queryFn: () => personasApi.aiDecisions(100, actionFilter),
  });

  const { data: stats } = useQuery({
    queryKey: ["personas-stats"],
    queryFn: personasApi.stats,
  });

  const recompute = useMutation({
    mutationFn: personasApi.compute,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-decisions"] });
      queryClient.invalidateQueries({ queryKey: ["personas-stats"] });
    },
  });

  const s = stats?.scores || {};

  const modelCards = [
    {
      icon: <Target size={20} className="text-blue-400" />,
      title: "AI Recommendation Builder",
      subtitle: "Right message · Right offer · Right time — per customer",
      stat: decisions.filter((d) => d.recommended_action?.action).length,
      statLabel: "active recommendations",
      color: "border-blue-600/30",
      bg: "bg-blue-600/5",
    },
    {
      icon: <TrendingUp size={20} className="text-blue-400" />,
      title: "Next Order & Winback Likelihood",
      subtitle: "Predicts who will buy or churn — triggers campaigns automatically",
      stat: stats?.scores?.winback_candidates ?? 0,
      statLabel: "winback candidates",
      color: "border-blue-600/30",
      bg: "bg-blue-600/5",
    },
    {
      icon: <Radio size={20} className="text-green-400" />,
      title: "AI Channel Affinity",
      subtitle: "Identifies which channel each customer responds to best",
      stat: decisions.filter((d) => d.channel_affinity?.whatsapp > 0.7).length,
      statLabel: "WhatsApp-preferred customers",
      color: "border-green-600/30",
      bg: "bg-green-600/5",
    },
    {
      icon: <Zap size={20} className="text-amber-400" />,
      title: "AI Propensity Models",
      subtitle: "Scores every customer's likelihood to act — prioritise revenue",
      stat: stats?.scores?.high_propensity ?? 0,
      statLabel: "high-propensity customers (score ≥70)",
      color: "border-amber-600/30",
      bg: "bg-amber-600/5",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap size={22} className="text-blue-400" />
            <h1 className="text-2xl font-bold text-white">AI Decisioning</h1>
          </div>
          <p className="text-gray-400 text-sm">
            From campaigns → to decisions.&nbsp;&nbsp;From segments → to individuals.
          </p>
          <p className="text-gray-500 text-xs mt-1">
            You set the goal. The agent decides — for every customer, in real time.
          </p>
        </div>
        <button
          onClick={() => recompute.mutate()}
          disabled={recompute.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={recompute.isPending ? "animate-spin" : ""} />
          {recompute.isPending ? "Computing..." : "Recompute AI Models"}
        </button>
      </div>

      {/* 4 Model Cards */}
      <div className="grid grid-cols-2 gap-4">
        {modelCards.map((card) => (
          <div key={card.title} className={`rounded-xl border ${card.color} ${card.bg} p-5`}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-800/80 flex items-center justify-center flex-shrink-0">
                {card.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-semibold text-sm">{card.title}</h3>
                <p className="text-gray-400 text-xs mt-0.5">{card.subtitle}</p>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-white">{card.stat.toLocaleString()}</span>
                  <span className="text-xs text-gray-500">{card.statLabel}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Decision Feed */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div>
            <h2 className="text-white font-semibold">Customer Decision Feed</h2>
            <p className="text-gray-400 text-xs mt-0.5">Ranked by AI propensity score — highest value actions first</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Filter action:</span>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
            >
              {ACTIONS.map((a) => (
                <option key={a} value={a}>{a || "All actions"}</option>
              ))}
            </select>
          </div>
        </div>

        {loadingDecisions ? (
          <div className="py-12 text-center text-gray-500 text-sm">Loading decisions...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  {["Customer", "Segment", "Action", "Channel Affinity", "Next Order", "Winback", "Propensity", "When", "Urgency"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {decisions.map((d) => {
                  const c = d.customer_id;
                  if (!c) return null;
                  const seg = d.rfm?.segment || "—";
                  const act = d.recommended_action || {};
                  const pred = d.predicted || {};
                  return (
                    <tr key={d._id} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                      <td className="px-4 py-3">
                        <div className="font-medium text-white text-sm">{c.name}</div>
                        <div className="text-xs text-gray-500">₹{(c.ltv || 0).toLocaleString()} LTV</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-600/20 text-blue-300 font-medium whitespace-nowrap">
                          {seg}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className={`text-xs px-2 py-1 rounded-lg font-medium inline-block capitalize whitespace-nowrap ${ACTION_STYLES[act.action] || ""}`}>
                          {act.action || "—"}
                        </div>
                        {act.message_hint && (
                          <div className="text-xs text-gray-500 mt-1 max-w-36 truncate">{act.message_hint}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ChannelAffinityBar affinity={d.channel_affinity} />
                      </td>
                      <td className="px-4 py-3 w-28">
                        <ScoreBar value={Math.round((pred.next_order_probability || 0) * 100)} color="bg-blue-500" />
                      </td>
                      <td className="px-4 py-3 w-28">
                        <ScoreBar value={Math.round((pred.winback_probability || 0) * 100)} color="bg-orange-500" />
                      </td>
                      <td className="px-4 py-3 w-28">
                        <ScoreBar value={pred.propensity_score || 0} color="bg-blue-500" />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {act.best_send_at || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border font-medium w-fit ${URGENCY_STYLES[act.urgency] || ""}`}>
                          <UrgencyIcon urgency={act.urgency} />
                          <span className="capitalize">{act.urgency || "—"}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {decisions.length === 0 && (
              <div className="py-12 text-center">
                <Zap size={36} className="text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No AI decisions yet.</p>
                <p className="text-gray-600 text-xs mt-1">Click "Recompute AI Models" to generate scores for all customers.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
