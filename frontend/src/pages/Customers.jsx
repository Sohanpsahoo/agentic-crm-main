import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, X, Users } from "lucide-react";
import { customersApi } from "../services/api";
import socket from "../services/socket";

const TAG_COLORS = {
  vip:          "bg-yellow-900/50 text-yellow-300 border-yellow-700/40",
  churned:      "bg-red-900/50 text-red-300 border-red-700/40",
  "at-risk":    "bg-orange-900/50 text-orange-300 border-orange-700/40",
  active:       "bg-green-900/50 text-green-300 border-green-700/40",
  loyal:        "bg-blue-900/50 text-blue-300 border-blue-700/40",
  champion:     "bg-purple-900/50 text-purple-300 border-purple-700/40",
  "one-time":   "bg-gray-700/50 text-gray-400 border-gray-600/40",
  "high-value": "bg-emerald-900/50 text-emerald-300 border-emerald-700/40",
  new:          "bg-cyan-900/50 text-cyan-300 border-cyan-700/40",
};
const CHANNEL_ICONS = { whatsapp: "💬", email: "📧", sms: "📱", rcs: "🔔" };
const ALL_TAGS = ["vip","churned","at-risk","active","loyal","champion","one-time","high-value","new"];

function Tag({ label }) {
  const cls = TAG_COLORS[label] || "bg-gray-700/50 text-gray-400 border-gray-600/40";
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>;
}

function Customer360Card({ customerId, onClose }) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    customersApi.get(customerId)
      .then(r => setCustomer(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [customerId]);

  if (loading) return (
    <div className="bg-gray-800 rounded-2xl border border-purple-600/40 p-5 space-y-3 animate-pulse">
      {[32, 48, 24, 24].map((w, i) => (
        <div key={i} className={`h-3 bg-gray-700 rounded w-${w}/48`} />
      ))}
    </div>
  );
  if (!customer) return null;

  const churnScore = customer.churn_score || 0;
  const churnColor = churnScore > 0.6 ? "text-red-400" : churnScore > 0.3 ? "text-yellow-400" : "text-green-400";
  const churnLabel = churnScore > 0.6 ? "High" : churnScore > 0.3 ? "Medium" : "Low";

  return (
    <div className="bg-gray-800 rounded-2xl border border-purple-600/40 p-5 shadow-2xl shadow-purple-900/20 relative animate-slideUp">
      <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
        <X size={16} />
      </button>

      <div className="mb-4">
        <h3 className="text-white font-bold text-lg">{customer.name}</h3>
        <p className="text-gray-400 text-sm">{customer.email}</p>
        {customer.phone && <p className="text-gray-500 text-xs mt-0.5">{customer.phone}</p>}
        {customer.demographics?.age_group && (
          <p className="text-gray-500 text-xs mt-0.5">Age group: {customer.demographics.age_group}</p>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-2 mb-4 bg-gray-900 rounded-xl p-3">
        {[
          { label: "LTV", val: `₹${(customer.ltv || 0).toLocaleString()}`, cls: "text-white" },
          { label: "Orders", val: customer.total_orders || 0, cls: "text-white" },
          { label: "Churn", val: churnLabel, cls: churnColor },
        ].map(({ label, val, cls }) => (
          <div key={label} className="text-center">
            <div className={`font-bold text-base ${cls}`}>{val}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Detail rows */}
      <div className="space-y-1.5 mb-4">
        {[
          ["Avg Order", `₹${(customer.avg_order_value || 0).toLocaleString()}`],
          customer.last_purchase_at && ["Last Purchase", new Date(customer.last_purchase_at).toLocaleDateString("en-IN")],
          customer.predicted_next_category && ["Predicted Next", customer.predicted_next_category],
          customer.location?.city && ["Location", `${customer.location.city}, ${customer.location.country || "India"}`],
        ].filter(Boolean).map(([label, val]) => (
          <div key={label} className="flex items-center justify-between bg-gray-900 rounded-lg px-3 py-2">
            <span className="text-gray-400 text-sm">{label}</span>
            <span className="text-white text-sm font-medium">{val}</span>
          </div>
        ))}
        {customer.channel_preferences && (
          <div className="flex items-center justify-between bg-gray-900 rounded-lg px-3 py-2">
            <span className="text-gray-400 text-sm">Channels</span>
            <div className="flex gap-1">
              {Object.entries(customer.channel_preferences).filter(([, v]) => v).map(([ch]) => (
                <span key={ch} title={ch}>{CHANNEL_ICONS[ch] || ch}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tags */}
      {customer.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {customer.tags.map(t => <Tag key={t} label={t} />)}
        </div>
      )}

      {/* Recent Orders */}
      {customer.recent_orders?.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Recent Orders</p>
          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {customer.recent_orders.slice(0, 5).map((order, i) => (
              <div key={i} className="bg-gray-900 rounded-lg px-3 py-2 flex justify-between items-center">
                <span className="text-xs text-gray-400 font-mono">#{order.order_number || `ORD-${i + 1}`}</span>
                <span className="text-xs text-white font-semibold">₹{(order.total || 0).toLocaleString()}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  order.status === "placed" ? "text-green-400" :
                  order.status === "delivered" ? "text-blue-400" : "text-gray-400"
                }`}>{order.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Customers() {
  const [searchParams] = useSearchParams();
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const [activeTag, setActiveTag] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = { page, limit: 20 };
    if (search.trim()) params.search = search.trim();
    if (activeTag) params.tag = activeTag;
    customersApi.list(params)
      .then(r => { setCustomers(r.data.customers || []); setTotal(r.data.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search, activeTag]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handleCustomerUpdated = () => {
      load();
    };
    socket.on("customer:updated", handleCustomerUpdated);
    return () => {
      socket.off("customer:updated", handleCustomerUpdated);
    };
  }, [load]);

  const applySearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearch("");
    setPage(1);
  };

  const toggleTag = (tag) => {
    setActiveTag(prev => prev === tag ? "" : tag);
    setPage(1);
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users size={22} className="text-purple-400" />
            Customers
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {loading ? "Loading..." : `${total.toLocaleString()} total`}
            {activeTag && <span className="ml-2 text-purple-400">· filtered by <strong>{activeTag}</strong></span>}
          </p>
        </div>
      </div>

      {/* Search + Tag Filter */}
      <div className="space-y-3">
        <form onSubmit={applySearch} className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 max-w-md">
          <Search size={15} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search by name or email..."
            className="flex-1 bg-transparent text-sm text-white focus:outline-none placeholder-gray-500"
            style={{ border: "none", boxShadow: "none" }}
          />
          {searchInput && (
            <button type="button" onClick={clearSearch} className="text-gray-500 hover:text-gray-300">
              <X size={13} />
            </button>
          )}
        </form>

        <div className="flex gap-1.5 flex-wrap">
          {ALL_TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all duration-150 ${
                activeTag === tag
                  ? (TAG_COLORS[tag] || "bg-purple-900/50 text-purple-300 border-purple-700/40")
                  : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500 hover:text-gray-200"
              }`}
            >
              {tag}
            </button>
          ))}
          {activeTag && (
            <button onClick={() => toggleTag("")} className="text-xs px-2.5 py-1 rounded-full border bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200">
              clear ✕
            </button>
          )}
        </div>
      </div>

      {/* Table + 360 Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className={selectedId ? "xl:col-span-2" : "xl:col-span-3"}>
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  {["Name", "LTV", "Orders", "Last Purchase", "Tags", "Churn"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-700/50 animate-pulse">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-3 bg-gray-700 rounded w-3/4" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : customers.map(c => (
                  <tr
                    key={c._id}
                    onClick={() => setSelectedId(selectedId === c._id ? null : c._id)}
                    className={`border-b border-gray-700/50 cursor-pointer transition-colors ${
                      selectedId === c._id ? "bg-purple-900/20" : "hover:bg-gray-700/30"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{c.name}</div>
                      <div className="text-xs text-gray-500">{c.email}</div>
                    </td>
                    <td className="px-4 py-3 text-white font-medium">₹{(c.ltv || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-white">{c.total_orders || 0}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {c.last_purchase_at ? new Date(c.last_purchase_at).toLocaleDateString("en-IN") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(c.tags || []).slice(0, 2).map(t => <Tag key={t} label={t} />)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-700 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              (c.churn_score || 0) > 0.7 ? "bg-red-500" :
                              (c.churn_score || 0) > 0.4 ? "bg-amber-500" : "bg-green-500"
                            }`}
                            style={{ width: `${(c.churn_score || 0) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{Math.round((c.churn_score || 0) * 100)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && customers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-14 text-center text-gray-500">
                      No customers found{search ? ` for "${search}"` : activeTag ? ` tagged "${activeTag}"` : ""}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-400">
              Page {page} · {total.toLocaleString()} customers
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 text-sm disabled:opacity-40 hover:bg-gray-700 transition-colors"
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={customers.length < 20}
                className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 text-sm disabled:opacity-40 hover:bg-gray-700 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        </div>

        {selectedId && (
          <div className="xl:col-span-1">
            <Customer360Card customerId={selectedId} onClose={() => setSelectedId(null)} />
          </div>
        )}
      </div>
    </div>
  );
}
