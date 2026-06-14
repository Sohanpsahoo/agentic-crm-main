import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Megaphone, Zap, Clock, CheckCircle, XCircle, Brain, X, UserCheck, Trash2 } from "lucide-react";
import { campaignsApi, segmentsApi } from "../services/api";
import api from "../services/api";
import socket from "../services/socket";

const STATUS_STYLE = {
  draft: "bg-gray-700/50 text-gray-300",
  running: "bg-green-900/50 text-green-300",
  completed: "bg-blue-900/50 text-blue-300",
  failed: "bg-red-900/50 text-red-300",
  paused: "bg-amber-900/50 text-amber-300",
  scheduled: "bg-blue-900/50 text-blue-300",
};

const GOAL_EMOJI = {
  "re-engage": "🔄",
  upsell: "⬆️",
  loyalty: "💎",
  announce: "📢",
  winback: "🏆",
};

const ACTION_COLORS = {
  re_engage:  "bg-blue-900/40 text-blue-300",
  winback:    "bg-blue-900/40 text-blue-300",
  upsell:     "bg-green-900/40 text-green-300",
  retain:     "bg-amber-900/40 text-amber-300",
  nurture:    "bg-gray-700/50 text-gray-300",
};

function AISelectPanel({ onClose }) {
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("all");
  const [selected, setSelected] = useState(new Set());
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    api.get("/personas", { params: { limit: 50, sort: "propensity" } })
      .then((r) => setPersonas(r.data.personas || r.data))
      .catch(() => setPersonas([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = actionFilter === "all"
    ? personas
    : personas.filter((p) => p.recommended_action === actionFilter);

  const toggleRow = (id) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const handleCreateSegment = async () => {
    if (selected.size === 0) return;
    setCreating(true);
    try {
      const customerIds = [...selected];
      await segmentsApi.create({
        name: `AI Selected — ${new Date().toLocaleDateString("en-IN")} (${customerIds.length} customers)`,
        description: `Auto-selected by AI based on propensity scores. Action filter: ${actionFilter}`,
        criteria_nl: `AI selection: ${actionFilter} action, ${customerIds.length} customers`,
        customer_ids: customerIds,
        created_by: "ai:persona",
      });
      setToast(`Segment created with ${customerIds.length} customers`);
      setTimeout(() => { setToast(null); onClose(); }, 2000);
    } catch {
      setToast("Failed to create segment");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-2xl bg-gray-900 border-l border-gray-800 flex flex-col h-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Brain size={18} className="text-blue-400" />
            <h2 className="font-semibold text-white">AI Customer Selection</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={18} /></button>
        </div>

        <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2 flex-wrap">
          {["all", "re_engage", "winback", "upsell", "retain", "nurture"].map((a) => (
            <button
              key={a}
              onClick={() => setActionFilter(a)}
              className={`px-2.5 py-1 rounded text-xs font-medium capitalize transition-colors ${
                actionFilter === a ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:text-gray-200"
              }`}
            >
              {a.replace("_", " ")}
            </button>
          ))}
          <span className="text-gray-500 text-xs ml-auto">{filtered.length} customers</span>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading personas…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No personas computed. Run /api/personas/compute first.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-900 border-b border-gray-800">
                <tr>
                  <th className="px-4 py-2 text-left text-gray-500 font-medium w-8">
                    <input
                      type="checkbox"
                      className="rounded bg-gray-700 border-gray-600"
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={(e) => setSelected(e.target.checked ? new Set(filtered.map((p) => p.customer_id?._id || p.customer_id)) : new Set())}
                    />
                  </th>
                  <th className="px-4 py-2 text-left text-gray-500 font-medium">Customer</th>
                  <th className="px-4 py-2 text-left text-gray-500 font-medium">Segment</th>
                  <th className="px-4 py-2 text-left text-gray-500 font-medium">Action</th>
                  <th className="px-4 py-2 text-right text-gray-500 font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const cid = p.customer_id?._id || p.customer_id;
                  return (
                    <tr
                      key={cid}
                      onClick={() => toggleRow(cid)}
                      className={`border-b border-gray-800/50 cursor-pointer hover:bg-gray-800/40 transition-colors ${
                        selected.has(cid) ? "bg-blue-900/20" : ""
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <input type="checkbox" className="rounded bg-gray-700 border-gray-600" checked={selected.has(cid)} onChange={() => {}} />
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-white font-medium">{p.customer_id?.name || cid}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="badge bg-gray-800 text-gray-300 capitalize">{p.rfm?.segment || "—"}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`badge capitalize ${ACTION_COLORS[p.recommended_action] || "bg-gray-800 text-gray-400"}`}>
                          {p.recommended_action?.replace("_", " ") || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`font-semibold ${
                          (p.predicted?.propensity_score || p.propensity_score || 0) > 0.7 ? "text-green-400" :
                          (p.predicted?.propensity_score || p.propensity_score || 0) > 0.4 ? "text-amber-400" : "text-gray-400"
                        }`}>
                          {((p.predicted?.propensity_score || p.propensity_score || 0) * 100).toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {toast && (
          <div className="px-5 py-3 bg-green-900/40 border-t border-green-700/40 text-green-300 text-sm">{toast}</div>
        )}

        <div className="px-5 py-4 border-t border-gray-800 flex items-center justify-between">
          <span className="text-gray-400 text-sm">{selected.size} selected</span>
          <button
            onClick={handleCreateSegment}
            disabled={selected.size === 0 || creating}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            <UserCheck size={15} />
            {creating ? "Creating…" : "Create Segment"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [total, setTotal] = useState(0);
  const [showAISelect, setShowAISelect] = useState(false);
  const navigate = useNavigate();

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this campaign?")) return;
    try {
      await campaignsApi.delete(id);
      setCampaigns((prev) => prev.filter((c) => c._id !== id));
      setTotal((prev) => prev - 1);
    } catch (err) {
      alert("Failed to delete campaign");
    }
  };

  useEffect(() => {
    campaignsApi.list({ limit: 30 }).then((r) => {
      setCampaigns(r.data.campaigns || []);
      setTotal(r.data.total || 0);
    });

    const handleCampaignCreated = (newCampaign) => {
      setCampaigns((prev) => {
        if (prev.some((c) => c._id === newCampaign._id)) return prev;
        return [newCampaign, ...prev];
      });
      setTotal((prev) => prev + 1);
    };

    const handleCampaignUpdated = (updatedCampaign) => {
      setCampaigns((prev) =>
        (prev || []).map((c) => (c._id === updatedCampaign._id ? updatedCampaign : c))
      );
    };

    socket.on("campaign:created", handleCampaignCreated);
    socket.on("campaign:updated", handleCampaignUpdated);

    return () => {
      socket.off("campaign:created", handleCampaignCreated);
      socket.off("campaign:updated", handleCampaignUpdated);
    };
  }, []);

  return (
    <div className="p-6 space-y-5">
      {showAISelect && <AISelectPanel onClose={() => setShowAISelect(false)} />}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaigns</h1>
          <p className="text-gray-400 text-sm mt-0.5">{total} campaigns</p>
        </div>
        <div className="flex items-center gap-2">

          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => navigate("/agent")}
          >
            <Zap size={16} />
            Create with AI
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {campaigns.length === 0 && (
          <div className="card text-center py-12 text-gray-500">
            No campaigns yet. Use the AI Agent to create your first campaign.
          </div>
        )}
        {campaigns.map((c) => (
          <div
            key={c._id}
            className="card cursor-pointer hover:border-gray-700 transition-colors"
            onClick={() => navigate(`/campaigns/${c._id}`)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span>{GOAL_EMOJI[c.goal] || "📣"}</span>
                  <h3 className="font-semibold text-white truncate">{c.name}</h3>
                  <span className={`badge ${STATUS_STYLE[c.status]}`}>{c.status}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>📡 {c.channel}</span>
                  <span>🎯 {c.segment_id?.name || "—"} ({c.segment_id?.size?.toLocaleString() || "?"} customers)</span>
                  <span>📅 {new Date(c.created_at).toLocaleDateString("en-IN")}</span>
                  {c.created_by_agent && (
                    <span className="badge bg-brand-900/40 text-brand-300 border border-brand-700/30">AI Generated</span>
                  )}
                </div>
              </div>

              {/* Mini funnel */}
              <div className="flex items-center gap-4 text-sm flex-shrink-0">
                <div className="text-center">
                  <p className="font-semibold text-white">{c.metrics_summary?.sent || 0}</p>
                  <p className="text-xs text-gray-500">Sent</p>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-blue-400">{c.metrics_summary?.opened || 0}</p>
                  <p className="text-xs text-gray-500">Opened</p>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-green-400">{c.metrics_summary?.converted || 0}</p>
                  <p className="text-xs text-gray-500">Converted</p>
                </div>
                <div className="ml-2 pl-2 border-l border-gray-700 flex items-center">
                  <button 
                    onClick={(e) => handleDelete(e, c._id)}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    title="Delete Campaign"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
