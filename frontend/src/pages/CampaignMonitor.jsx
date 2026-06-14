import React, { useEffect, useState } from "react";
import { monitorApi } from "../services/api";
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Play, ChevronDown, ChevronRight } from "lucide-react";
import socket from "../services/socket";

const SEVERITY_STYLE = {
  critical: "bg-red-900/40 border-red-700/40 text-red-400",
  warning:  "bg-amber-900/40 border-amber-700/40 text-amber-400",
  healthy:  "bg-green-900/40 border-green-700/40 text-green-400",
};

const METRIC_LABEL = {
  open_rate:       "Open Rate",
  ctr:             "CTR",
  conversion_rate: "Conversion",
};

const CHANNEL_THRESHOLDS = {
  whatsapp: { open_rate: 30, ctr: 8,  conversion_rate: 2 },
  email:    { open_rate: 15, ctr: 2,  conversion_rate: 0.8 },
  sms:      { open_rate: 20, ctr: 4,  conversion_rate: 1 },
};

function AlertCard({ alert, onApply, onDismiss }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(null);

  const thresh = CHANNEL_THRESHOLDS[alert.channel] || {};

  const handleApply = async () => {
    setLoading("apply");
    try { await onApply(alert._id); } finally { setLoading(null); }
  };
  const handleDismiss = async () => {
    setLoading("dismiss");
    try { await onDismiss(alert._id); } finally { setLoading(null); }
  };

  return (
    <div className={`card border ${SEVERITY_STYLE[alert.severity]} space-y-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {alert.severity === "healthy" ? (
              <CheckCircle size={16} className="text-green-400" />
            ) : (
              <AlertTriangle size={16} className={alert.severity === "critical" ? "text-red-400" : "text-amber-400"} />
            )}
            <span className="font-semibold text-white truncate">{alert.campaign_name || alert.campaign_id}</span>
            <span className="badge bg-gray-800 text-gray-300 capitalize">{alert.channel}</span>
            <span className={`badge ${SEVERITY_STYLE[alert.severity]} capitalize`}>{alert.severity}</span>
            {alert.status === "applied" && <span className="badge bg-green-900/40 text-green-400">Applied</span>}
            {alert.status === "dismissed" && <span className="badge bg-gray-800 text-gray-500">Dismissed</span>}
          </div>
          <p className="text-sm text-gray-300 mt-1">
            <span className="font-medium">{METRIC_LABEL[alert.metric_failed] || alert.metric_failed}</span>
            {" "}<span className="text-red-400">{alert.actual_value?.toFixed(1)}%</span>
            {" "}vs expected{" "}
            <span className="text-green-400">{alert.expected_value?.toFixed(1)}%</span>
          </p>
        </div>
        <button
          className="text-gray-500 hover:text-gray-300 flex-shrink-0"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 pt-2 border-t border-gray-700/50">
          {alert.ai_diagnosis && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">AI Diagnosis</p>
              <p className="text-sm text-gray-300">{alert.ai_diagnosis}</p>
            </div>
          )}
          {alert.suggested_copy && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Suggested Copy</p>
              <div className="rounded-lg bg-gray-800/60 border border-gray-700 p-3 text-sm text-green-300 font-mono whitespace-pre-wrap">
                {alert.suggested_copy}
              </div>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Recommended Action</p>
            <span className="badge bg-blue-900/40 text-blue-300 border-blue-700/40 capitalize">
              {alert.recommended_action?.replace(/_/g, " ")}
            </span>
          </div>

          {alert.status === "pending" && (
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleApply}
                disabled={!!loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading === "apply" ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                Apply & Resend to Non-Openers
              </button>
              <button
                onClick={handleDismiss}
                disabled={!!loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading === "dismiss" ? <RefreshCw size={14} className="animate-spin" /> : <XCircle size={14} />}
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CampaignMonitor() {
  const [alerts, setAlerts] = useState([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState("pending");
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAlerts = async () => {
    const params = filter !== "all" ? { status: filter } : {};
    const r = await monitorApi.alerts(params);
    setAlerts(r.data.alerts || r.data);
    setTotal(r.data.total || (r.data.alerts || r.data).length);
  };

  useEffect(() => {
    fetchAlerts().catch(() => {});
  }, [filter]);

  useEffect(() => {
    const handler = (data) => {
      showToast(`${data.alerts?.length || 0} new monitor alert(s)`, "warning");
      fetchAlerts().catch(() => {});
    };
    socket.on("monitor:alerts", handler);
    return () => socket.off("monitor:alerts", handler);
  }, [filter]);

  const handleRun = async () => {
    setRunning(true);
    try {
      await monitorApi.run();
      showToast("Monitor started — alerts will appear shortly", "info");
      setTimeout(() => fetchAlerts().catch(() => {}), 5000);
    } catch {
      showToast("Failed to start monitor", "error");
    } finally {
      setRunning(false);
    }
  };

  const handleApply = async (id) => {
    await monitorApi.apply(id);
    showToast("Applied — resending to non-openers", "success");
    fetchAlerts().catch(() => {});
  };

  const handleDismiss = async (id) => {
    await monitorApi.dismiss(id);
    fetchAlerts().catch(() => {});
  };

  return (
    <div className="p-6 space-y-5">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium border ${
          toast.type === "success" ? "bg-green-900 border-green-700 text-green-300" :
          toast.type === "error"   ? "bg-red-900 border-red-700 text-red-300" :
          toast.type === "warning" ? "bg-amber-900 border-amber-700 text-amber-300" :
          "bg-gray-800 border-gray-700 text-gray-200"
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <AlertTriangle size={22} className="text-amber-400" />
            Campaign Monitor
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">AI analyses running campaigns and alerts on underperformance</p>
        </div>
        <button
          onClick={handleRun}
          disabled={running}
          className="btn-primary flex items-center gap-2"
        >
          {running ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
          Run Monitor Now
        </button>
      </div>

      <div className="flex items-center gap-2">
        {["pending", "applied", "dismissed", "all"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              filter === f ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:text-gray-200"
            }`}
          >
            {f}
          </button>
        ))}
        <span className="text-gray-500 text-sm ml-2">{total} alerts</span>
      </div>

      <div className="space-y-3">
        {alerts.length === 0 && (
          <div className="card text-center py-12 text-gray-500">
            {filter === "pending"
              ? 'No pending alerts. Click "Run Monitor Now" to analyse campaigns.'
              : `No ${filter} alerts.`}
          </div>
        )}
        {alerts.map((a) => (
          <AlertCard
            key={a._id}
            alert={a}
            onApply={handleApply}
            onDismiss={handleDismiss}
          />
        ))}
      </div>
    </div>
  );
}
