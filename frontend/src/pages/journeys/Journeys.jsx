import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Trash2 } from "lucide-react";
import React from "react";
import { journeysApi, agentApi } from "../../services/api";

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
      // Generate steps automatically using AI based on journey info
      const generated = await agentApi.generateJourney({
        name: formData.name,
        description: formData.description,
        trigger: formData.trigger
      }).catch(e => ({ steps: [] })); // Fallback to empty if AI fails

      await journeysApi.create({
        name: formData.name,
        description: formData.description,
        trigger: { type: formData.trigger },
        steps: generated.steps || []
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
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              placeholder="e.g. Welcome Series"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
            <textarea
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 resize-none h-20"
              placeholder="What does this journey do?"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Trigger</label>
            <select
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
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
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
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
    condition: "",
    campaign_goal: ""
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const config = {};
      if (formData.type === "wait") config.wait_days = formData.wait_days;
      if (formData.type === "message" || formData.type === "offer") {
        config.channel = formData.channel;
        config.campaign_goal = formData.campaign_goal;
        try {
          const generatedContent = await agentApi.messagePreview(
            formData.campaign_goal || "General update",
            formData.channel,
            "Added manually to journey"
          );
          config.message_content = generatedContent;
        } catch (e) {
          console.error("Failed to generate message content", e);
        }
      }
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
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
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
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                value={formData.wait_days}
                onChange={e => setFormData({ ...formData, wait_days: parseInt(e.target.value) })}
              />
            </div>
          )}

          {(formData.type === "message" || formData.type === "offer") && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Channel</label>
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  value={formData.channel}
                  onChange={e => setFormData({ ...formData, channel: e.target.value })}
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  {formData.type === "message" ? "Message / Goal" : "Offer Details"}
                </label>
                <input
                  required
                  type="text"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  placeholder={formData.type === "message" ? "e.g. Welcome Message" : "e.g. 10% Discount"}
                  value={formData.campaign_goal}
                  onChange={e => setFormData({ ...formData, campaign_goal: e.target.value })}
                />
              </div>
            </div>
          )}

          {formData.type === "condition" && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Condition</label>
              <input
                required
                type="text"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
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
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Adding..." : "Add Step"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StepPreviewModal({ step, journey, onClose }) {
  const [preview, setPreview] = useState(step.config?.message_content || null);
  const [loading, setLoading] = useState(!step.config?.message_content);

  React.useEffect(() => {
    // Only fetch if not already generated and saved in the step config
    if (!step.config?.message_content && (step.type === "message" || step.type === "offer")) {
      agentApi.messagePreview(
        step.config?.campaign_goal || "General update", 
        step.config?.channel || "email", 
        journey.description || "Customer journey"
      ).then(res => {
        setPreview(res);
        setLoading(false);
      }).catch(err => {
        setPreview({ error: "Failed to load preview" });
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [step, journey]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-gray-900 border border-gray-800 rounded-xl flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="font-semibold text-white">
            {step.type === "message" ? "Message Preview" : step.type === "offer" ? "Offer Preview" : "Step Details"}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h3 className="text-xs text-gray-500 uppercase font-semibold mb-2">Intent / Goal</h3>
            <p className="text-blue-300 text-sm italic">
              "{step.config?.campaign_goal || step.type}"
            </p>
          </div>

          {(step.type === "message" || step.type === "offer") && (
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-xs text-gray-500 uppercase font-semibold mb-2 flex items-center justify-between">
                <span>Live AI Preview</span>
                <span className="text-[10px] bg-blue-900/40 text-blue-400 px-2 py-0.5 rounded capitalize">
                  {step.config?.channel || "email"}
                </span>
              </h3>
              {loading ? (
                <div className="animate-pulse space-y-2 py-2">
                  <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-700 rounded w-5/6"></div>
                  <div className="h-4 bg-gray-700 rounded w-1/2"></div>
                </div>
              ) : preview?.error ? (
                <p className="text-red-400 text-sm">{preview.error}</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-white text-sm font-medium">{preview?.headline}</p>
                  <p className="text-gray-300 text-sm leading-relaxed">{preview?.body}</p>
                  {preview?.rationale && (
                    <div className="mt-3 p-3 bg-blue-900/20 border border-blue-900/40 rounded-lg">
                      <p className="text-xs font-semibold text-blue-400 mb-1">AI Rationale</p>
                      <p className="text-xs text-blue-200/70">{preview.rationale}</p>
                    </div>
                  )}
                  {preview?.cta && (
                    <button className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg mt-2">
                      {preview.cta}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Journeys() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [addingStepTo, setAddingStepTo] = useState(null);
  const [previewingStep, setPreviewingStep] = useState(null);
  const queryClient = useQueryClient();

  const { data: journeys = [], isLoading } = useQuery({
    queryKey: ["journeys"],
    queryFn: () => journeysApi.list(),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }) => journeysApi.setStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["journeys"] }),
  });

  const deleteJourney = useMutation({
    mutationFn: (id) => journeysApi.delete(id),
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
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
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

      {previewingStep && (
        <StepPreviewModal
          step={previewingStep.step}
          journey={previewingStep.journey}
          onClose={() => setPreviewingStep(null)}
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

                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => {
                      if(window.confirm('Are you sure you want to delete this journey?')) {
                        deleteJourney.mutate(journey._id);
                      }
                    }}
                    className="text-gray-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-400/10 transition-colors"
                    title="Delete Journey"
                  >
                    <Trash2 size={16} />
                  </button>
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
                <span className="text-xs px-2 py-1 rounded-lg bg-blue-600/20 text-blue-300 font-medium">
                  ⚡ {TRIGGER_LABELS[journey.trigger?.type] || journey.trigger?.type}
                </span>
              </div>

              {/* Steps flow */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 mt-4">
                {(journey.steps || []).map((step, i) => (
                  <div key={step.step_id} className="flex items-center gap-2 flex-shrink-0">
                    <div 
                      onClick={() => (step.type === 'message' || step.type === 'offer') ? setPreviewingStep({ step, journey }) : null}
                      className={`bg-gray-700 rounded-lg px-3 py-2 text-sm ${(step.type === 'message' || step.type === 'offer') ? 'cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all' : ''}`}
                    >
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
                      {step.config?.campaign_goal && (
                        <div className="text-blue-300 text-[11px] mt-1 bg-blue-900/30 px-1.5 py-0.5 rounded break-words max-w-[150px]">
                          "{step.config.campaign_goal}"
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
                  <div className="text-blue-400 font-semibold">
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
