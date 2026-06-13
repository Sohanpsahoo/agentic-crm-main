import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { offersApi } from "../../services/api";

const STATUS_COLORS = {
  active: "text-green-400 bg-green-400/10",
  paused: "text-yellow-400 bg-yellow-400/10",
  draft: "text-gray-400 bg-gray-400/10",
  expired: "text-red-400 bg-red-400/10",
};

const TYPE_LABELS = {
  percentage: (v) => `${v}% OFF`,
  fixed: (v) => `₹${v} OFF`,
  points_multiplier: (v) => `${v}x Points`,
  free_product: () => "Free Product",
};

export default function Offers() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "percentage",
    value: 20,
    code_prefix: "OFFER",
    status: "draft",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["offers", statusFilter],
    queryFn: () => offersApi.list(statusFilter),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }) => offersApi.setStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["offers"] }),
  });

  const createOffer = useMutation({
    mutationFn: offersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offers"] });
      setShowForm(false);
      setForm({ name: "", description: "", type: "percentage", value: 20, code_prefix: "OFFER", status: "draft" });
    },
  });

  const offers = data?.offers || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Offers Engine</h1>
          <p className="text-gray-400 mt-1">Coupons, discounts, and promotional offers</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + New Offer
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {["", "active", "draft", "paused", "expired"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              statusFilter === s
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {/* Offers grid */}
      {isLoading ? (
        <div className="text-gray-500 py-12 text-center">Loading offers...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {offers.map((offer) => (
            <div key={offer._id} className="bg-gray-800 rounded-xl border border-gray-700 p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[offer.status]}`}
                  >
                    {offer.status}
                  </span>
                </div>
                <div className="text-2xl font-bold text-purple-400">
                  {TYPE_LABELS[offer.type]?.(offer.value) || offer.value}
                </div>
              </div>

              <div>
                <h3 className="text-white font-semibold">{offer.name}</h3>
                <p className="text-gray-400 text-sm mt-1">{offer.description}</p>
              </div>

              <div className="text-xs text-gray-500 space-y-1">
                <div>Code prefix: <span className="text-gray-300 font-mono">{offer.code_prefix}</span></div>
                <div>Budget: ₹{(offer.budget?.total_budget || 0).toLocaleString()} | Used: ₹{(offer.budget?.spent || 0).toLocaleString()}</div>
                <div>Max uses: {offer.budget?.max_uses || "∞"}</div>
                {offer.validity?.end && (
                  <div>Expires: {new Date(offer.validity.end).toLocaleDateString()}</div>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                {offer.status === "active" && (
                  <button
                    onClick={() => toggleStatus.mutate({ id: offer._id, status: "paused" })}
                    className="flex-1 text-xs py-1.5 rounded-lg bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20 transition-colors"
                  >
                    Pause
                  </button>
                )}
                {offer.status !== "active" && offer.status !== "expired" && (
                  <button
                    onClick={() => toggleStatus.mutate({ id: offer._id, status: "active" })}
                    className="flex-1 text-xs py-1.5 rounded-lg bg-green-400/10 text-green-400 hover:bg-green-400/20 transition-colors"
                  >
                    Activate
                  </button>
                )}
              </div>
            </div>
          ))}
          {offers.length === 0 && (
            <div className="col-span-3 py-12 text-center text-gray-500">
              No offers found. Create one or run the seed script.
            </div>
          )}
        </div>
      )}

      {/* Create offer modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-md p-6 space-y-4">
            <h2 className="text-white text-lg font-semibold">New Offer</h2>

            {[
              { label: "Name", key: "name", type: "text" },
              { label: "Description", key: "description", type: "text" },
              { label: "Code Prefix", key: "code_prefix", type: "text" },
              { label: "Value", key: "value", type: "number" },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label className="text-sm text-gray-400 block mb-1">{label}</label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: type === "number" ? Number(e.target.value) : e.target.value }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
            ))}

            <div>
              <label className="text-sm text-gray-400 block mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
              >
                <option value="percentage">Percentage Off</option>
                <option value="fixed">Fixed Amount Off</option>
                <option value="points_multiplier">Points Multiplier</option>
                <option value="free_product">Free Product</option>
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-lg bg-gray-700 text-gray-300 text-sm hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => createOffer.mutate(form)}
                disabled={!form.name || createOffer.isPending}
                className="flex-1 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {createOffer.isPending ? "Creating..." : "Create Offer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
