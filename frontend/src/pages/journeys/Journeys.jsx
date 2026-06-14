import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { journeysApi } from "../../services/api";

const TRIGGER_LABELS = {
  signup: "New Signup",
  first_purchase: "First Purchase",
  nth_purchase: "Nth Purchase",
  inactivity: "Inactivity",
  cart_abandon: "Cart Abandon",
  birthday: "Birthday",
  points_milestone: "Points Milestone",
};

const STATUS_STYLES = {
  active: "text-green-400 bg-green-400/10",
  draft: "text-gray-400 bg-gray-400/10",
  paused: "text-yellow-400 bg-yellow-400/10",
};

const STEP_ICONS = { message: "💬", wait: "⏱", condition: "🔀", offer: "🎁" };

function CreateJourneyModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    trigger: "signup"
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await journeysApi.create({
        name: formData.name,
        description: formData.description,
        trigger: { type: formData.trigger },
        steps: []
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to create journey");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-gray-900 border border-gray-800 rounded-xl flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="font-semibold text-white">Create New Journey</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Name</label>
            <input
              required
              type="text"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
              placeholder="e.g. Welcome Series"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
            <textarea
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 resize-none h-20"
              placeholder="What does this journey do?"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Trigger</label>
            <select
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
              value={formData.trigger}
              onChange={e => setFormData({ ...formData, trigger: e.target.value })}
            >
              {Object.entries(TRIGGER_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Journey"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddStepModal({ journeyId, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    type: "wait",
    wait_days: 1,
    channel: "whatsapp",
    condition: ""
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const config = {};
      if (formData.type === "wait") config.wait_days = formData.wait_days;
      if (formData.type === "message") config.channel = formData.channel;
      if (formData.type === "condition") config.condition = formData.condition;

      await journeysApi.addStep(journeyId, {
        type: formData.type,
        config
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to add step");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-gray-900 border border-gray-800 rounded-xl flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="font-semibold text-white">Add Step</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Step Type</label>
            <select
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
              value={formData.type}
              onChange={e => setFormData({ ...formData, type: e.target.value })}
            >
              <option value="wait">Wait</option>
              <option value="message">Message</option>
              <option value="condition">Condition</option>
              <option value="offer">Offer</option>
            </select>
          </div>
          
          {formData.type === "wait" && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Wait Days</label>
              <input
                required
                type="number"
                min="1"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                value={formData.wait_days}
                onChange={e => setFormData({ ...formData, wait_days: parseInt(e.target.value) })}
              />
            </div>
          )}

          {formData.type === "message" && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Channel</label>
              <select
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                value={formData.channel}
                onChange={e => setFormData({ ...formData, channel: e.target.value })}
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </select>
            </div>
          )}

          {formData.type === "condition" && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Condition</label>
              <input
                required
                type="text"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                placeholder="e.g. Has purchased > $100"
                value={formData.condition}
                onChange={e => setFormData({ ...formData, condition: e.target.value })}
              />
            </div>
          )}

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? "Adding..." : "Add Step"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Journeys() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [addingStepTo, setAddingStepTo] = useState(null);
  const queryClient = useQueryClient();

  const { data: journeys = [], isLoading } = useQuery({
    queryKey: ["journeys"],
    queryFn: () => journeysApi.list(),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }) => journeysApi.setStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["journeys"] }),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Journey Builder</h1>
          <p className="text-gray-400 mt-1">Automated multi-step customer journeys</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Create Journey
        </button>
      </div>

      {showCreateModal && (
        <CreateJourneyModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["journeys"] })}
        />
      )}

      {addingStepTo && (
        <AddStepModal
          journeyId={addingStepTo}
          onClose={() => setAddingStepTo(null)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["journeys"] })}
        />
      )}

      {isLoading ? (
        <div className="text-gray-500 py-12 text-center">Loading journeys...</div>
      ) : (
        <div className="space-y-4">
          {journeys.map((journey) => (
            <div key={journey._id} className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-white font-semibold text-lg">{journey.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[journey.status]}`}>
                      {journey.status}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mt-1">{journey.description}</p>
                </div>

                <div className="flex gap-2">
                  {journey.status === "active" && (
                    <button
                      onClick={() => toggleStatus.mutate({ id: journey._id, status: "paused" })}
                      className="text-xs px-3 py-1.5 rounded-lg bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20 transition-colors"
                    >
                      Pause
                    </button>
                  )}
                  {journey.status !== "active" && (
                    <button
                      onClick={() => toggleStatus.mutate({ id: journey._id, status: "active" })}
                      className="text-xs px-3 py-1.5 rounded-lg bg-green-400/10 text-green-400 hover:bg-green-400/20 transition-colors"
                    >
                      Activate
                    </button>
                  )}
                </div>
              </div>

              {/* Trigger badge */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-gray-500">Trigger:</span>
                <span className="text-xs px-2 py-1 rounded-lg bg-purple-600/20 text-purple-300 font-medium">
                  ⚡ {TRIGGER_LABELS[journey.trigger?.type] || journey.trigger?.type}
                </span>
              </div>

              {/* Steps flow */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 mt-4">
                {(journey.steps || []).map((step, i) => (
                  <div key={step.step_id} className="flex items-center gap-2 flex-shrink-0">
                    <div className="bg-gray-700 rounded-lg px-3 py-2 text-sm">
                      <div className="text-white flex items-center gap-1.5">
                        <span>{STEP_ICONS[step.type] || "📌"}</span>
                        <span className="capitalize">{step.type}</span>
                      </div>
                      {step.config?.channel && (
                        <div className="text-gray-400 text-xs mt-0.5 capitalize">{step.config.channel}</div>
                      )}
                      {step.config?.wait_days && (
                        <div className="text-gray-400 text-xs mt-0.5">Wait {step.config.wait_days}d</div>
                      )}
                      {step.config?.condition && (
                        <div className="text-gray-400 text-xs mt-0.5">
                          {typeof step.config.condition === "string" 
                            ? step.config.condition 
                            : JSON.stringify(step.config.condition)}
                        </div>
                      )}
                    </div>
                    <span className="text-gray-500 text-lg">→</span>
                  </div>
                ))}
                <button
                  onClick={() => setAddingStepTo(journey._id)}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg border border-dashed border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 transition-colors flex-shrink-0 text-sm"
                >
                  <Plus size={14} /> Add Step
                </button>
              </div>

              {/* Stats */}
              <div className="flex gap-6 mt-4 pt-4 border-t border-gray-700">
                <div>
                  <div className="text-xs text-gray-500">Enrolled</div>
                  <div className="text-white font-semibold">{(journey.enrolled_count || 0).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Completed</div>
                  <div className="text-white font-semibold">{(journey.completed_count || 0).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Completion Rate</div>
                  <div className="text-purple-400 font-semibold">
                    {journey.enrolled_count
                      ? ((journey.completed_count / journey.enrolled_count) * 100).toFixed(0) + "%"
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Steps</div>
                  <div className="text-white font-semibold">{journey.steps?.length || 0}</div>
                </div>
              </div>
            </div>
          ))}

          {journeys.length === 0 && (
            <div className="py-12 text-center text-gray-500">
              No journeys found. Run the seed script or ask the AI to create one.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
