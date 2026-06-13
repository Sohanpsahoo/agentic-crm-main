import React, { useState, useEffect, useRef } from "react";
import { Play, Bot, Loader2, CheckCircle2, AlertCircle, Sparkles, HelpCircle, ShieldCheck, ArrowRight, Send, MessageSquare, Smartphone, ExternalLink, Zap } from "lucide-react";
import { agentApi, segmentsApi } from "../services/api";
import useAgentStore from "../store/agentStore";
import socket from "../services/socket";
import { useNavigate } from "react-router-dom";

function AgentEvent({ event }) {
  const icons = {
    supervisor: "🧠",
    segmentation: "🎯",
    campaign_creation: "✍️",
    personalization: "👤",
    channel_selection: "📡",
    execution: "🚀",
    analytics: "📊",
    optimization: "⚡",
    human_approval: "⏸️",
    persona_agent: "🪪",
    journey_builder: "🗺️",
    system: "⚙️",
  };

  return (
    <div className="flex gap-3 py-2.5 border-b border-gray-850 last:border-b-0">
      <div className="w-8 h-8 rounded-full bg-purple-900/40 border border-purple-700/30 flex items-center justify-center text-sm flex-shrink-0 mt-0.5 shadow-sm">
        {icons[event.agent] || "🤖"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-purple-400 uppercase tracking-wide">
            {event.agent?.replace(/_/g, " ") || "agent"}
          </span>
          <span className="text-[10px] text-gray-500 font-mono">
            {new Date(event.ts).toLocaleTimeString()}
          </span>
        </div>
        <p className="text-sm text-gray-300 mt-1 leading-relaxed">{event.message}</p>
        
        {event.data?.size && (
          <div className="mt-1.5">
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-950/40 text-cyan-300 border border-cyan-800/30">
              Matched: {event.data.size} customers
            </span>
          </div>
        )}
        
        {event.data?.metrics && (
          <div className="mt-2 grid grid-cols-3 gap-2 bg-gray-950 p-2 rounded-lg border border-gray-800 text-center max-w-sm">
            <div>
              <p className="text-xs text-gray-500">Open Rate</p>
              <p className="text-sm font-bold text-white">{event.data.metrics.open_rate}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">CTR</p>
              <p className="text-sm font-bold text-white">{event.data.metrics.ctr}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Conversion</p>
              <p className="text-sm font-bold text-white">{event.data.metrics.conversion_rate}%</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AgentChat() {
  const navigate = useNavigate();
  const [chatHistory, setChatHistory] = useState([
    {
      role: "model",
      content: "Hey! 👋 I'm your AI CRM Director — powered by Groq. I have full control over this CRM and can help you with:\n\n📋 **View & Edit Data** — customers, segments, campaigns, offers, journeys, products\n🚀 **Launch Campaigns** — full AI pipeline: segment → copy → personalize → dispatch\n📊 **Analytics** — overview KPIs, channel performance, ROI, business metrics\n⚠️ **Monitor Alerts** — detect underperforming campaigns and auto-fix them\n\nJust tell me what you need. Examples:\n• \"Show me all VIP customers\"\n• \"How is our WhatsApp channel performing?\"\n• \"Launch a winback email campaign for churned customers\"\n• \"Pause campaign [name]\"\n• \"What's our conversion rate this month?\"\n• \"Create a 20% off offer for loyal customers\"\n\nWhat would you like to do?",
      ts: new Date()
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [blastResult, setBlastResult] = useState(null); // tracks last simulate blast result
  const [scheduleType, setScheduleType] = useState("now");
  
  const chatBottomRef = useRef(null);
  const consoleBottomRef = useRef(null);

  const { sessions, activeSessionId, startSession, getActiveSession } = useAgentStore();
  const activeSession = getActiveSession();

  // Listen for blast events from the backend socket
  useEffect(() => {
    const handleBlastSent = (data) => {
      setBlastResult(data);
      // Auto-clear after 20 seconds
      setTimeout(() => setBlastResult(null), 20000);
    };
    socket.on("agent:blast_sent", handleBlastSent);
    return () => socket.off("agent:blast_sent", handleBlastSent);
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory.length, loadingChat]);

  // Scroll console to bottom
  useEffect(() => {
    consoleBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.events?.length]);

  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || loadingChat) return;

    const userMsg = inputText.trim();
    setInputText("");
    setChatHistory((prev) => [...prev, { role: "user", content: userMsg, ts: new Date() }]);
    setLoadingChat(true);

    try {
      // Build history for API context
      const historyPayload = chatHistory.map(h => ({
        role: h.role,
        content: h.content
      }));

      const response = await agentApi.chat(userMsg, historyPayload, "Marketer");
      const reply = response.data?.reply || "I'm on it! Let me know if you want to launch this campaign.";
      
      setChatHistory((prev) => [...prev, { role: "model", content: reply, ts: new Date() }]);
    } catch (err) {
      console.error(err);
      setChatHistory((prev) => [
        ...prev,
        {
          role: "model",
          content: "Sorry, I had trouble processing that creative direction. Shall we try setting up a campaign direct?",
          ts: new Date()
        }
      ]);
    } finally {
      setLoadingChat(false);
    }
  };

  const handleQuickCampaign = async (campaignDirective) => {
    setSubmitting(true);
    setChatHistory((prev) => [
      ...prev,
      { role: "user", content: `Let's launch: ${campaignDirective}`, ts: new Date() },
      { role: "model", content: "Understood! I am compiling the segment coordinates, drafting variant copies, and booting up the LangGraph execution flow. Watch the live console on the right!", ts: new Date() }
    ]);

    try {
      const { data } = await agentApi.runTask(campaignDirective);
      startSession(data.session_id, campaignDirective);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproval = async (approved) => {
    if (!activeSessionId) return;
    await agentApi.resumeTask(activeSessionId, { approved, schedule: scheduleType });
    useAgentStore.getState().addEvent(activeSessionId, {
      type: "progress",
      agent: "system",
      message: approved 
        ? `Marketer approved campaign [Schedule: ${scheduleType.toUpperCase()}] — launching execution dispatch pipeline...` 
        : "Campaign execution rejected and cancelled by marketer.",
    });
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/50 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Bot size={22} className="text-purple-400 animate-pulse" />
            Agentic Campaign Director
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">Full CRM control via Groq AI — view/edit customers, segments, campaigns, analytics, offers, journeys and more.</p>
        </div>
        <div className="flex items-center gap-2 bg-purple-950/30 border border-purple-800/40 rounded-full px-3 py-1">
          <Sparkles size={12} className="text-purple-300" />
          <span className="text-[10px] text-purple-300 font-bold uppercase tracking-wider">Groq CRM Director</span>
        </div>
      </div>

      {/* Side-by-Side Panels */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Side: Conversational Chat with Creative Director */}
        <div className="w-1/2 border-r border-gray-850 flex flex-col h-full bg-zinc-950/20">
          <div className="p-4 border-b border-gray-850 bg-gray-950/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-950/40 flex items-center justify-center border border-purple-900/30">
                <Bot size={16} className="text-purple-400" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400">Creative Ad Head</h3>
                <p className="text-[10px] text-emerald-450 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" /> Active Brain
                </p>
              </div>
            </div>
          </div>

          {/* Chat message list */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {chatHistory.map((chat, idx) => {
              const isUser = chat.role === "user";
              return (
                <div key={idx} className={`flex gap-3 max-w-[85%] ${isUser ? "self-end ml-auto flex-row-reverse" : "self-start"}`}>
                  {!isUser && (
                    <div className="w-8 h-8 rounded-lg bg-purple-950/45 border border-purple-900/30 flex items-center justify-center text-xs flex-shrink-0">
                      💡
                    </div>
                  )}
                  <div className={`p-4 rounded-2xl ${
                    isUser
                      ? "bg-purple-600 text-white rounded-tr-none"
                      : "bg-zinc-900/80 border border-zinc-850 rounded-tl-none text-zinc-200"
                  }`}>
                    <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{chat.content}</p>
                    <span className="text-[9px] text-zinc-550 block mt-1.5 text-right">
                      {new Date(chat.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              );
            })}

            {loadingChat && (
              <div className="flex gap-3 max-w-[85%] self-start animate-pulse">
                <div className="w-8 h-8 rounded-lg bg-purple-950/45 border border-purple-900/30 flex items-center justify-center text-xs flex-shrink-0">
                  💭
                </div>
                <div className="bg-zinc-900/80 border border-zinc-850 rounded-2xl rounded-tl-none p-4 text-zinc-400 text-[13px] flex items-center gap-2">
                  <span>Brainstorming strategies</span>
                  <div className="flex gap-1">
                    <span className="w-1 h-1 rounded-full bg-purple-400 animate-bounce delay-75"></span>
                    <span className="w-1 h-1 rounded-full bg-purple-400 animate-bounce delay-150"></span>
                    <span className="w-1 h-1 rounded-full bg-purple-400 animate-bounce delay-225"></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Quick Action Ideas bar */}
          <div className="px-4 py-2 border-t border-gray-900 bg-gray-950/20 flex gap-2 overflow-x-auto whitespace-nowrap">
            <button
              onClick={() => handleQuickCampaign("Find customers who haven't ordered in 60 days and send them a 15% off winback email campaign.")}
              disabled={submitting || activeSession?.status === "running"}
              className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-purple-950/50 border border-purple-900/40 text-purple-300 hover:bg-purple-900/30 transition-all flex-shrink-0"
            >
              🚀 Copilot: Recover Lost Customers
            </button>
            <button
              onClick={() => handleQuickCampaign("Identify our highest LTV VIPs and launch an exclusive early-access WhatsApp campaign for the new collection.")}
              disabled={submitting || activeSession?.status === "running"}
              className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-emerald-950/50 border border-emerald-900/40 text-emerald-300 hover:bg-emerald-900/30 transition-all flex-shrink-0"
            >
              💎 Copilot: VIP Upsell
            </button>
            <button
              onClick={() => handleQuickCampaign("Send a cart abandonment SMS with a 10% discount to everyone who added items yesterday but didn't buy.")}
              disabled={submitting || activeSession?.status === "running"}
              className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-blue-950/50 border border-blue-900/40 text-blue-300 hover:bg-blue-900/30 transition-all flex-shrink-0"
            >
              🛒 Copilot: Cart Rescue
            </button>
            <button
              onClick={() => {
                setInputText("Give me a narrative summary of our analytics and channel performance.");
              }}
              disabled={submitting}
              className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-cyan-950/50 border border-cyan-900/40 text-cyan-300 hover:bg-cyan-900/30 transition-all flex-shrink-0"
            >
              📊 Summarize Analytics
            </button>
            <button
              onClick={() => {
                setInputText("Suggest 3 new customer segments I should target this week based on recent behavior.");
              }}
              disabled={submitting}
              className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-amber-950/50 border border-amber-900/40 text-amber-300 hover:bg-amber-900/30 transition-all flex-shrink-0"
            >
              🎯 Suggest Segments
            </button>
          </div>

          {/* Chat message input */}
          <form onSubmit={handleSendChatMessage} className="p-4 border-t border-gray-850 bg-gray-950/50 flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask anything: 'Show VIP customers', 'Pause campaign X', 'What's our open rate?'..."
              className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-[13px] text-white focus:outline-none focus:border-purple-600 placeholder-gray-550"
              disabled={submitting || activeSession?.status === "running"}
            />
            <button
              type="submit"
              disabled={!inputText.trim() || submitting || activeSession?.status === "running"}
              className="w-10 h-10 rounded-xl bg-purple-600 hover:bg-purple-700 flex items-center justify-center text-white disabled:opacity-40 transition-all flex-shrink-0"
            >
              <Send size={15} />
            </button>
          </form>
        </div>

        {/* Right Side: Live Execution Console */}
        <div className="w-1/2 p-6 flex flex-col overflow-hidden bg-gray-950">
          <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Play className="text-purple-400 rotate-90" size={15} />
              <h2 className="font-semibold text-sm uppercase tracking-wider">Execution Pipeline Console</h2>
            </div>
            {activeSession && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                activeSession.status === "completed" ? "bg-green-950 text-green-400 border border-green-900" : "bg-purple-950 text-purple-400 border border-purple-900 animate-pulse"
              }`}>
                {activeSession.status === "completed" ? "FINISHED" : "RUNNING"}
              </span>
            )}
          </div>

          {/* Blast Result Banner — appears when simulate_message_to_devices fires */}
          {blastResult && (
            <div className="mb-4 p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-xl animate-pulse-once">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-emerald-400" />
                  <span className="text-emerald-400 font-bold text-xs uppercase tracking-wide">
                    Blast Dispatched — {blastResult.count} devices
                  </span>
                </div>
                <button
                  onClick={() => navigate("/whatsapp")}
                  className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                >
                  <Smartphone size={11} />
                  View in Simulation Center
                  <ExternalLink size={10} />
                </button>
              </div>
              <p className="text-gray-400 text-[11px] mb-2">Messages are live on customer phone screens. Preview:</p>
              <div className="space-y-1.5">
                {(blastResult.preview || []).map((p, i) => (
                  <div key={i} className="flex gap-2 items-start bg-gray-950/60 rounded-lg px-3 py-2">
                    <Smartphone size={11} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-emerald-300">{p.customer_name}</span>
                      <p className="text-[11px] text-gray-400 truncate">{p.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto bg-gray-900/40 border border-gray-850 rounded-xl p-5 font-sans space-y-4">
            {!activeSession && !blastResult ? (
              <div className="h-full flex flex-col justify-center items-center text-center text-gray-500 py-12">
                <MessageSquare size={42} className="text-gray-850 mb-3 animate-pulse" />
                <p className="text-sm font-semibold">Console Ready</p>
                <p className="text-xs text-gray-650 max-w-xs mt-1">Converse with the Creative Director on the left. Click one of the quick launch templates or type a goal to trigger the LangGraph automation engine.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeSession && (
                  <>
                {/* User Prompt Summary Header */}
                <div className="bg-gray-950/60 p-3 rounded-lg border border-gray-800 text-xs space-y-1">
                  <div className="text-gray-500 font-bold uppercase tracking-wider">Directives Sent:</div>
                  <div className="text-gray-300 font-mono italic">"{activeSession.query}"</div>
                </div>

                {/* Agent Action Events Logs */}
                <div className="space-y-1">
                  {activeSession.events.map((event, i) => (
                    <AgentEvent key={i} event={event} />
                  ))}

                  {activeSession.status === "running" && (
                    <div className="flex items-center gap-2.5 py-3 text-xs text-gray-400 font-mono">
                      <Loader2 size={13} className="animate-spin text-purple-400" />
                      Agent executing LangGraph workflow...
                    </div>
                  )}

                  {/* Human-in-the-Loop Gate */}
                  {activeSession.status === "awaiting_approval" && (() => {
                    const approvalEvent = activeSession.events.find(e => e.step === "await_approval");
                    const pData = approvalEvent?.data || {};
                    return (
                      <div className="my-4 p-5 bg-purple-950/10 border border-purple-800/30 rounded-xl shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                           <p className="text-purple-400 font-bold text-xs uppercase tracking-wide flex items-center gap-1.5">
                             <Sparkles size={14} /> AI CAMPAIGN PROPOSAL
                           </p>
                           <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-900/40 text-amber-400 border border-amber-700/30">
                             REVIEW REQUIRED
                           </span>
                        </div>
                        
                        <div className="space-y-3 mb-5">
                           {/* Audience & Reason */}
                           <div className="grid grid-cols-2 gap-3">
                              <div className="bg-gray-900/60 p-3 rounded-lg border border-gray-800">
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Target Audience</p>
                                <p className="text-xs font-semibold text-white">{pData.segment_name || "Custom Segment"}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{pData.audience_size?.toLocaleString() || 0} customers</p>
                              </div>
                              <div className="bg-gray-900/60 p-3 rounded-lg border border-gray-800">
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">AI Reasoning</p>
                                <p className="text-xs text-gray-300 italic">"{pData.segment_reason || "Based on predictive churn modeling"}"</p>
                              </div>
                           </div>
                           
                           {/* Channel & Prediction */}
                           <div className="grid grid-cols-2 gap-3">
                              <div className="bg-gray-900/60 p-3 rounded-lg border border-gray-800">
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Recommended Channel</p>
                                <p className="text-xs font-semibold text-white capitalize flex items-center gap-1.5">
                                  {pData.channel === 'whatsapp' ? '💬' : pData.channel === 'email' ? '📧' : '📱'}
                                  {pData.channel || "Auto"}
                                </p>
                              </div>
                              <div className="bg-gray-900/60 p-3 rounded-lg border border-gray-800">
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Predicted Success</p>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-semibold text-emerald-400">Open: {pData.predicted_metrics?.open_rate || 0}%</span>
                                  <span className="text-xs font-semibold text-cyan-400">Conv: {pData.predicted_metrics?.conversion_rate || 0}%</span>
                                </div>
                              </div>
                           </div>
                           
                           {/* Message Preview */}
                           <div className="bg-gray-900/60 p-3 rounded-lg border border-gray-800">
                               <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">Draft Message Preview</p>
                               <p className="text-xs text-gray-300 leading-relaxed bg-black/40 p-2.5 rounded border border-gray-800/60">
                                  {pData.message_preview || "Your message draft will appear here..."}
                               </p>
                           </div>
                         </div>

                         {/* Campaign Scheduler Picker */}
                         <div className="bg-gray-900/60 p-3 rounded-lg border border-gray-800 mb-4">
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Campaign Dispatch Schedule</p>
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { id: "now", label: "⚡ Send Now", desc: "Instant dispatch" },
                                { id: "tomorrow", label: "📅 Send Tomorrow", desc: "At 09:00 AM" },
                                { id: "best_time", label: "🎯 AI Best Time", desc: "Optimal customer hour" }
                              ].map((opt) => (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => setScheduleType(opt.id)}
                                  className={`p-2 rounded-lg border text-left transition-all ${
                                    scheduleType === opt.id
                                      ? "border-purple-500 bg-purple-950/20 text-white"
                                      : "border-gray-850 bg-gray-950/45 hover:border-gray-700 text-gray-400"
                                  }`}
                                >
                                  <p className="text-[11.5px] font-bold">{opt.label}</p>
                                  <p className="text-[9px] text-gray-500 mt-0.5">{opt.desc}</p>
                                </button>
                              ))}
                            </div>
                         </div>

                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleApproval(true)}
                            className="flex-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-3 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle2 size={14} /> One-Click Approve & Launch
                          </button>
                          <button 
                            onClick={() => handleApproval(false)}
                            className="bg-gray-800 hover:bg-gray-750 text-gray-300 text-xs font-bold px-4 py-2.5 rounded-lg transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Campaign Complete */}
                  {activeSession.status === "completed" && activeSession.result && (
                    <div className="my-4 p-4 bg-green-950/20 border border-green-900/30 rounded-xl">
                      <div className="flex items-center gap-2 mb-1.5">
                        <CheckCircle2 size={16} className="text-green-400" />
                        <p className="text-green-400 font-bold text-xs uppercase tracking-wide">Orchestration Successful</p>
                      </div>
                      <p className="text-gray-300 text-xs leading-relaxed">{activeSession.result.summary}</p>
                    </div>
                  )}
                </div>
                  </>
                )}
              </div>
            )}
            <div ref={consoleBottomRef} />
          </div>
        </div>

      </div>
    </div>
  );
}
