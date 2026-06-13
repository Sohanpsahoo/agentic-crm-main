import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PieChart, RefreshCw, Bot, Plus, X, ShieldAlert, Users, Sparkles, Trash2 } from "lucide-react";
import { segmentsApi } from "../services/api";

function CreateSegmentModal({ onClose, onCreated }) {
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [estimatedSize, setEstimatedSize] = useState(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [logs, setLogs] = useState([]);

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
    setLogs(["[System] Analyzing Natural Language Prompt..."]);
    
    const logInterval = setInterval(() => {
      setLogs(prev => {
        if (prev.length === 1) return [...prev, "[Agent] Intent Identified. Constructing structured query..."];
        if (prev.length === 2) return [...prev, "[System] Executing MongoDB Aggregation Pipeline on Customer DB..."];
        return prev;
      });
    }, 800);

    try {
      await segmentsApi.generate(query);
      clearInterval(logInterval);
      setLogs(prev => [...prev, "[Agent] Pipeline Generated successfully. 🚀"]);
      setTimeout(() => {
        onCreated();
      }, 1000); // let the user read the success log briefly
    } catch (err) {
      clearInterval(logInterval);
      setLogs(prev => [...prev, "[Error] Failed to generate segment."]);
      console.error(err);
      alert("Failed to generate segment. Make sure the AI service is running.");
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
          
          {submitting || logs.length > 0 ? (
            <div className="bg-black/60 border border-gray-800/80 rounded-lg p-3 h-32 overflow-y-auto font-mono text-[10px] flex flex-col justify-end">
               <div>
                 {logs.map((log, i) => (
                   <p key={i} className={log.includes("Error") ? "text-red-400 mb-1" : "text-emerald-400/90 mb-1"}>
                     {log}
                   </p>
                 ))}
                 {submitting && (
                   <p className="text-gray-500 animate-pulse mt-1">_</p>
                 )}
               </div>
            </div>
          ) : (
            <div className="bg-purple-900/20 border border-purple-800/30 rounded-lg p-3 flex gap-3">
               <div className="mt-0.5"><Bot size={16} className="text-purple-400" /></div>
               <div>
                  <p className="text-sm font-medium text-purple-200">AI-Powered Extraction</p>
                  <p className="text-xs text-purple-300/70 mt-1">
                     The Copilot will parse your intent, query the real-time customer database, and instantly generate an accurate segment pipeline.
                  </p>
               </div>
            </div>
          )}

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

function CampaignDesignerModal({ segment, onClose }) {
  const [name, setName] = useState(`${segment.name} Campaign`);
  const [goal, setGoal] = useState("announce");
  const [template, setTemplate] = useState("");
  const [channel, setChannel] = useState("whatsapp");
  const [scheduling, setScheduling] = useState(false);
  const [generating, setGenerating] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    // Auto-generate AI message for this segment
    import("../services/api").then(({ agentApi }) => {
      const goalStr = "Draft a highly engaging, personalized promotional message.";
      const audDesc = `Name: ${segment.name}. Size: ${segment.size}. Criteria: ${segment.criteria_nl || "All customers"}`;
      agentApi.messagePreview(goalStr, "whatsapp", audDesc)
        .then(res => {
          setTemplate(res.data.message || "");
          setGenerating(false);
        })
        .catch(err => {
          console.error(err);
          setTemplate("Hi {name}, we have some special updates for you!");
          setGenerating(false);
        });
    });
  }, [segment]);

  const handleSaveDraft = async (e) => {
    e.preventDefault();
    setScheduling(true);
    try {
      const { campaignsApi } = await import("../services/api");
      const res = await campaignsApi.create({
        name,
        goal,
        channel,
        status: "draft",
        segment_id: segment._id,
        copy_variants: [{ variant_id: "A", body: template }]
      });
      onClose(false);
      navigate(`/campaigns/${res.data._id}`);
    } catch(err) {
      console.error(err);
      alert("Failed to create draft campaign.");
    } finally {
      setScheduling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={() => onClose(false)} />
      <div className="relative w-full max-w-lg bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 bg-gray-900/50">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-400" />
            <h2 className="font-semibold text-white">Create Draft Campaign</h2>
          </div>
          <button onClick={() => onClose(false)} className="text-gray-500 hover:text-gray-300"><X size={18} /></button>
        </div>

        <form onSubmit={handleSaveDraft} className="p-5 space-y-4">
          <div className="bg-gray-950 p-3 rounded-lg border border-gray-800 flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Target Segment</p>
              <p className="text-sm font-bold text-white mt-0.5">{segment.name}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Audience</p>
              <p className="text-sm font-bold text-indigo-400 mt-0.5">{segment.size?.toLocaleString()} customers</p>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Campaign Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-600 mt-1"
              required
            />
          </div>

          <div className="flex gap-4">
             <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Goal</label>
              <select 
                value={goal} 
                onChange={e => setGoal(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-600"
              >
                <option value="announce">Announce</option>
                <option value="re-engage">Re-engage</option>
                <option value="upsell">Upsell</option>
                <option value="winback">Winback</option>
                <option value="loyalty">Loyalty</option>
                <option value="welcome">Welcome</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Channel</label>
              <select 
                value={channel} 
                onChange={e => setChannel(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-600"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Message Template</label>
              {generating && <span className="text-[10px] text-indigo-400 flex items-center gap-1 animate-pulse"><Bot size={12}/> AI Drafting...</span>}
            </div>
            <textarea
              rows="4"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3.5 py-3 text-sm text-white focus:outline-none focus:border-indigo-600 resize-none"
              disabled={generating}
              required
            />
            <p className="text-[10px] text-gray-500 mt-1">Use <code className="text-gray-400">{'{name}'}</code> to personalize.</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => onClose(false)} className="flex-1 btn-secondary py-2.5">Cancel</button>
            <button type="submit" disabled={scheduling || generating || !template || !name} className="flex-1 btn-primary py-2.5 disabled:opacity-50 justify-center bg-indigo-600 hover:bg-indigo-500">
              {scheduling ? "Saving..." : "Save Draft Campaign"}
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
  const [selectedSegment, setSelectedSegment] = useState(null);

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

  const deleteSegment = async (id) => {
    try {
      await segmentsApi.delete(id);
      loadSegments();
    } catch (e) {
      alert("Failed to delete segment.");
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
      
      {selectedSegment && (
        <CampaignDesignerModal 
          segment={selectedSegment} 
          onClose={(shouldReload) => {
            setSelectedSegment(null);
            if (shouldReload === true) loadSegments();
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => refresh(s._id)}
                  className="text-gray-500 hover:text-gray-300 transition-colors p-1"
                  title="Refresh segment"
                >
                  <RefreshCw size={14} />
                </button>
                <button
                  onClick={() => deleteSegment(s._id)}
                  className="text-gray-500 hover:text-red-400 transition-colors p-1"
                  title="Delete segment"
                >
                  <Trash2 size={14} />
                </button>
              </div>
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
                   <p className="text-xs text-gray-300 mt-1 mb-2">Matched: <span className="text-purple-200">{s.description}</span></p>
                )}
                
                {/* Agent Logs & Pipeline Viewer */}
                <details className="mt-2 group">
                  <summary className="text-[10px] uppercase tracking-wider font-bold text-gray-500 cursor-pointer hover:text-purple-400 transition-colors list-none flex items-center gap-1">
                    <span className="group-open:rotate-90 transition-transform text-gray-600 font-mono">▶</span>
                    Agent Logs & Decision Pipeline
                  </summary>
                  <div className="mt-2 p-2.5 bg-black/40 rounded border border-gray-800/50 max-h-48 overflow-y-auto">
                    <div className="text-[10px] font-mono text-emerald-400/80 mb-2 space-y-1">
                      <p>[System] Analyzing Natural Language Prompt...</p>
                      <p>[Agent] Intent Identified: Targeting {s.name}</p>
                      <p>[Agent] Constructing structured query for Customer collection...</p>
                      <p>[System] Executing MongoDB Aggregation Pipeline.</p>
                      <p>[Agent] Found {s.size} matching customers.</p>
                    </div>
                    {s.criteria_json && (
                      <>
                        <div className="text-[10px] text-gray-400 mt-2 font-semibold">Generated MongoDB Pipeline:</div>
                        <pre className="text-[9px] font-mono text-purple-300/70 mt-1 whitespace-pre-wrap break-all bg-gray-950 p-2 rounded">
                          {JSON.stringify(s.criteria_json, null, 2)}
                        </pre>
                      </>
                    )}
                  </div>
                </details>
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

            <button 
              onClick={() => setSelectedSegment(s)} 
              className="w-full mt-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Bot size={14} /> Create Draft Campaign
            </button>

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
