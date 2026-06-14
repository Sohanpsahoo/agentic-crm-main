import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import personasApi from "../../services/personasApi";

const SEGMENTS = ["Champions", "Loyal", "At Risk", "Cannot Lose", "Lost", "New", "Potential"];

const SEG_COLORS = {
  Champions:      { bg: "bg-blue-600/20", text: "text-blue-300", border: "border-blue-600/30" },
  Loyal:          { bg: "bg-blue-600/20",   text: "text-blue-300",   border: "border-blue-600/30" },
  "At Risk":      { bg: "bg-amber-600/20",  text: "text-amber-300",  border: "border-amber-600/30" },
  "Cannot Lose":  { bg: "bg-red-600/20",    text: "text-red-300",    border: "border-red-600/30" },
  Lost:           { bg: "bg-gray-700/40",   text: "text-gray-400",   border: "border-gray-600/30" },
  New:            { bg: "bg-cyan-600/20",   text: "text-cyan-300",   border: "border-cyan-600/30" },
  Potential:      { bg: "bg-green-600/20",  text: "text-green-300",  border: "border-green-600/30" },
};

const SEG_DESC = {
  Champions:     "R≥4, F≥4, M≥4 — Top buyers, high value",
  Loyal:         "F≥3, M≥3 — Consistent, profitable",
  "At Risk":     "R≤2, F≥3 — Used to buy, going quiet",
  "Cannot Lose": "R=1, F≥4 — Were champions, now silent",
  Lost:          "R=1, F≤2 — Haven't bought in months",
  New:           "R≥4, F≤1 — Just started their journey",
  Potential:     "Others — Moderate engagement",
};

const CHANNEL_ICONS = { whatsapp: "💬", email: "📧", sms: "📱" };

export default function Personas() {
  const queryClient = useQueryClient();
  const [activeSegment, setActiveSegment] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["personas", activeSegment, page],
    queryFn: () => personasApi.list(activeSegment, page),
  });

  const { data: dist = [] } = useQuery({
    queryKey: ["rfm-dist"],
    queryFn: personasApi.distribution,
  });

  const recompute = useMutation({
    mutationFn: personasApi.compute,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["personas"] }),
  });

  const personas = data?.personas || [];
  const total = data?.total || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">RFM Personas</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {total.toLocaleString()} customers across {dist.length} segments
          </p>
        </div>
        <button
          onClick={() => recompute.mutate()}
          disabled={recompute.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={recompute.isPending ? "animate-spin" : ""} />
          {recompute.isPending ? "Computing..." : "Recompute RFM"}
        </button>
      </div>

      {/* Segment filter pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setActiveSegment(""); setPage(1); }}
          className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
            !activeSegment ? "bg-blue-600 text-white border-blue-600" : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500"
          }`}
        >
          All
        </button>
        {SEGMENTS.map((seg) => {
          const c = SEG_COLORS[seg];
          const count = dist.find((d) => d.segment === seg)?.count || 0;
          return (
            <button
              key={seg}
              onClick={() => { setActiveSegment(seg === activeSegment ? "" : seg); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                seg === activeSegment
                  ? `${c.bg} ${c.text} ${c.border}`
                  : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500"
              }`}
            >
              {seg} {count > 0 && <span className="text-xs opacity-70">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Active segment description */}
      {activeSegment && (
        <div className={`rounded-lg p-3 border text-sm ${SEG_COLORS[activeSegment].bg} ${SEG_COLORS[activeSegment].border}`}>
          <span className={`font-semibold ${SEG_COLORS[activeSegment].text}`}>{activeSegment}</span>
          <span className="text-gray-400 ml-2">— {SEG_DESC[activeSegment]}</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              {["Customer", "Segment / Label", "RFM Score", "Best Channel", "Churn Risk", "Next Order", "Propensity", "Action"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="py-12 text-center text-gray-500">Loading personas...</td></tr>
            ) : personas.map((p) => {
              const c = p.customer_id || {};
              const seg = p.rfm?.segment || "Potential";
              const sc = SEG_COLORS[seg] || SEG_COLORS.Potential;
              return (
                <tr key={p._id} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{c.name || "—"}</div>
                    <div className="text-xs text-gray-500">₹{(c.ltv || 0).toLocaleString()}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className={`text-xs px-2 py-1 rounded-full inline-block font-medium ${sc.bg} ${sc.text}`}>
                      {seg}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{p.persona_label}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-white font-bold">{p.rfm?.rfm_score || "—"}</span>
                    <span className="text-gray-500 text-xs ml-1">/15</span>
                    <div className="text-xs text-gray-600 mt-0.5">
                      R{p.rfm?.recency_score} F{p.rfm?.frequency_score} M{p.rfm?.monetary_score}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-sm">
                      <span>{CHANNEL_ICONS[p.engagement?.best_channel] || "📧"}</span>
                      <span className="text-white capitalize">{p.engagement?.best_channel || "email"}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {Math.round((p.engagement?.avg_open_rate || 0) * 100)}% open · {p.engagement?.best_send_hour}:00
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className={`text-sm font-semibold ${
                      (p.predicted?.churn_probability || 0) > 0.6 ? "text-red-400" :
                      (p.predicted?.churn_probability || 0) > 0.3 ? "text-amber-400" : "text-green-400"
                    }`}>
                      {Math.round((p.predicted?.churn_probability || 0) * 100)}%
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-white text-sm font-semibold">
                      {Math.round((p.predicted?.next_order_probability || 0) * 100)}%
                    </div>
                    <div className="text-xs text-gray-500">in ~{p.predicted?.next_purchase_days || 30}d</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-700 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-blue-500"
                          style={{ width: `${p.predicted?.propensity_score || 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-7">{p.predicted?.propensity_score || 0}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-lg font-medium capitalize ${
                      p.recommended_action?.urgency === "high" ? "bg-red-400/10 text-red-400" :
                      p.recommended_action?.urgency === "medium" ? "bg-amber-400/10 text-amber-400" :
                      "bg-green-400/10 text-green-400"
                    }`}>
                      {p.recommended_action?.action || "nurture"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!isLoading && personas.length === 0 && (
          <div className="py-12 text-center text-gray-500 text-sm">
            No personas found. Run seed_personas.js or click "Recompute RFM".
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">Page {page} · {total.toLocaleString()} total</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 text-sm disabled:opacity-40 hover:bg-gray-700">
              ← Prev
            </button>
            <button onClick={() => setPage((p) => p + 1)} disabled={personas.length < 20}
              className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 text-sm disabled:opacity-40 hover:bg-gray-700">
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
