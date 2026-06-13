import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

export default function Journeys() {
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
      </div>

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
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
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
                    </div>
                    {i < journey.steps.length - 1 && (
                      <span className="text-gray-500 text-lg">→</span>
                    )}
                  </div>
                ))}
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
