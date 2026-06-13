import React, { useEffect, useState } from "react";
import { PieChart, RefreshCw, Bot, Plus, X, ShieldAlert, Users, Sparkles } from "lucide-react";
import { segmentsApi } from "../services/api";

function CreateSegmentModal({ onClose, onCreated }) {
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [estimatedSize, setEstimatedSize] = useState(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);

  // Live audience size estimator with debouncing
  useEffect(() => {
    if (!query.trim()) {
      setEstimatedSize(null);
      return;
    }
    
    setLoadingEstimate(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const r = await segmentsApi.estimate(query);
        setEstimatedSize(r.data.count);
      } catch (err) {
        console.error("Estimation failed:", err);
      } finally {
        setLoadingEstimate(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setSubmitting(true);
    try {
      await segmentsApi.generate(query);
      onCreated();
    } catch (err) {
      console.error(err);
      alert("Failed to generate segment. Make sure the AI service is running.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 bg-gray-900/50">
          <div className="flex items-center gap-2">
            <Bot size={18} className="text-purple-400" />
            <h2 className="font-semibold text-white">AI Segment Builder</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Natural Language Prompt</label>
            <textarea
              rows="4"
              placeholder="e.g. 'Find high value customers who prefer WhatsApp.'"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3.5 py-3 text-sm text-white focus:outline-none focus:border-purple-600 resize-none"
              autoFocus
            />
          </div>
          
          {/* Live Estimated Audience Indicator */}
          {query.trim() && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-950 border border-gray-850 rounded-lg text-xs">
              <span className="text-gray-400 font-bold uppercase tracking-wider">Estimated Audience</span>
              <span className="font-extrabold text-sm text-white flex items-center gap-2">
                {loadingEstimate ? (
                  <span className="text-gray-500 flex items-center gap-1.5">
                    <RefreshCw size={12} className="animate-spin" /> Estimating...
                  </span>
                ) : estimatedSize !== null ? (
                  <span className="text-purple-400">{estimatedSize.toLocaleString()} customer(s)</span>
                ) : (
                  <span className="text-gray-500">—</span>
                )}
              </span>
            </div>
          )}
          
          <div className="bg-purple-900/20 border border-purple-800/30 rounded-lg p-3 flex gap-3">
             <div className="mt-0.5"><Bot size={16} className="text-purple-400" /></div>
             <div>
                <p className="text-sm font-medium text-purple-200">AI-Powered Extraction</p>
                <p className="text-xs text-purple-300/70 mt-1">
                   The Copilot will parse your intent, query the real-time customer database, and instantly generate an accurate segment pipeline.
                </p>
             </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary py-2.5">Cancel</button>
            <button type="submit" disabled={submitting || !query.trim()} className="flex-1 btn-primary py-2.5 disabled:opacity-50 justify-center">
              {submitting ? "Generating..." : "Generate Segment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Segments() {
  const [segments, setSegments] = useState([]);
  const [showModal, setShowModal] = useState(false);

  const loadSegments = () => {
    segmentsApi.list().then((r) => setSegments(r.data));
  };

  useEffect(() => {
    loadSegments();
  }, []);

  const refresh = async (id) => {
    await segmentsApi.refresh(id);
    loadSegments();
  };

  const generatePersona = async (id) => {
    try {
       await segmentsApi.generatePersona(id);
       loadSegments();
    } catch (e) {
       alert("Failed to generate persona card. Ensure AI service is running.");
    }
  };

  return (
    <div className="p-6 space-y-5">
      {showModal && (
        <CreateSegmentModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            loadSegments();
          }}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Segments</h1>
          <p className="text-gray-400 text-sm mt-0.5">{segments.length} segments active</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} />
          Create Segment
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {segments.length === 0 && (
          <div className="card col-span-3 text-center py-10 text-gray-500">
            No segments yet. Click "Create Segment" to create a targeted shopper group.
          </div>
        )}
        {segments.map((s) => (
          <div key={s._id} className="card space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-white">{s.name}</h3>
                {s.description && (
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{s.description}</p>
                )}
              </div>
              <button
                onClick={() => refresh(s._id)}
                className="text-gray-500 hover:text-gray-300 transition-colors"
                title="Refresh segment"
              >
                <RefreshCw size={14} />
              </button>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div>
                <p className="text-xl font-bold text-white">{s.size?.toLocaleString()}</p>
                <p className="text-xs text-gray-400">customers</p>
              </div>
              {s.created_by === "agent:segmentation" && (
                <span className="badge bg-brand-900/40 text-brand-300 border border-brand-700/30 flex items-center gap-1">
                  <Bot size={10} />
                  AI Created
                </span>
              )}
            </div>

            {s.criteria_nl && (
              <div className="bg-purple-900/10 border border-purple-800/20 rounded-lg px-3 py-2.5 mt-2">
                <div className="flex items-center gap-1.5 mb-1">
                   <Bot size={12} className="text-purple-400" />
                   <span className="text-[10px] uppercase tracking-wider font-bold text-purple-400">AI Reasoning</span>
                </div>
                <p className="text-xs text-gray-300">Prompt: <span className="italic text-gray-400">"{s.criteria_nl}"</span></p>
                {s.description && (
                   <p className="text-xs text-gray-300 mt-1">Matched: <span className="text-purple-200">{s.description}</span></p>
                )}
              </div>
            )}
            
            {/* AI Persona Card */}
            {s.persona_card ? (
               <div className="mt-3 bg-gradient-to-br from-indigo-900/30 to-purple-900/20 border border-indigo-800/40 rounded-xl p-4 shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                     <div className="flex items-center gap-2">
                        <Sparkles size={14} className="text-indigo-400" />
                        <h4 className="text-sm font-bold text-indigo-300">{s.persona_card.persona_name}</h4>
                     </div>
                     <span className="text-[10px] text-indigo-200/50 uppercase tracking-widest font-bold">Persona</span>
                  </div>
                  <div className="space-y-3 text-xs">
                     <div>
                        <span className="text-gray-500 font-semibold block mb-0.5">Demographics</span>
                        <p className="text-gray-300">{s.persona_card.demographics}</p>
                     </div>
                     <div>
                        <span className="text-gray-500 font-semibold block mb-0.5">Motivations</span>
                        <p className="text-gray-300">{s.persona_card.motivations}</p>
                     </div>
                     <div>
                        <span className="text-gray-500 font-semibold block mb-0.5">Traits</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                           {(s.persona_card.traits || []).map(t => (
                              <span key={t} className="px-2 py-0.5 bg-indigo-950/50 border border-indigo-800 text-indigo-300 rounded-full text-[10px]">{t}</span>
                           ))}
                        </div>
                     </div>
                  </div>
               </div>
            ) : (
               <button onClick={() => generatePersona(s._id)} className="w-full mt-2 bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-900/50 text-indigo-300 text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2">
                  <Sparkles size={14} /> Generate Persona Card
               </button>
            )}

            {s.last_refreshed_at && (
              <p className="text-[10px] text-gray-600 mt-3 pt-3 border-t border-gray-800/50">
                Refreshed: {new Date(s.last_refreshed_at).toLocaleString("en-IN")}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
