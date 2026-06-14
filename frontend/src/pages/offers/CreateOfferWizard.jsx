import React, { useState } from "react";
import { X, ChevronRight, ChevronLeft, Check, Sparkles } from "lucide-react";
import { agentApi } from "../../services/api";

const STEPS = [
  "Offer Type",
  "Select Customers",
  "Financial Controls",
  "Coupon Configuration",
  "Distribution"
];

export default function CreateOfferWizard({ onClose, onCreate, isPending }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "percentage",
    value: 20,
    validity_start: "",
    validity_end: "",
    target_all: true,
    min_orders: 0,
    channels: ["email", "whatsapp", "sms"],
    total_budget: 0,
    max_uses: 0,
    uses_per_customer: 1,
    auto_generate_codes: true,
    code_prefix: "OFFER",
    status: "draft"
  });

  const [nlTarget, setNlTarget] = useState("");
  const [generatedSegment, setGeneratedSegment] = useState(null);
  const [isGeneratingSegment, setIsGeneratingSegment] = useState(false);

  const nextStep = () => setStep(s => Math.min(s + 1, 5));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const handleSubmit = () => {
    // Map local form state to API payload
    const payload = {
      name: form.name,
      description: form.description,
      type: form.type,
      value: Number(form.value),
      code_prefix: form.code_prefix,
      auto_generate_codes: form.auto_generate_codes,
      status: form.status,
      validity: {
        ...(form.validity_start && { start: new Date(form.validity_start) }),
        ...(form.validity_end && { end: new Date(form.validity_end) })
      },
      targeting: {
        min_orders: Number(form.min_orders),
        channels: form.channels
      },
      budget: {
        total_budget: Number(form.total_budget),
        max_uses: Number(form.max_uses),
        uses_per_customer: Number(form.uses_per_customer)
      }
    };
    onCreate(payload);
  };

  const handleChannelToggle = (ch) => {
    setForm(f => {
      let newChannels = f.channels;
      
      if (ch === "auto") {
        newChannels = f.channels.includes("auto") ? [] : ["auto"];
      } else {
        if (f.channels.includes("auto")) {
          newChannels = [ch];
        } else {
          newChannels = f.channels.includes(ch) 
            ? f.channels.filter(c => c !== ch)
            : [...f.channels, ch];
        }
      }
      
      return { ...f, channels: newChannels };
    });
  };

  const generateAudience = async () => {
    if (!nlTarget) return;
    setIsGeneratingSegment(true);
    setGeneratedSegment(null);
    try {
      const res = await agentApi.segmentPreview(nlTarget);
      setGeneratedSegment(res.data || res);
      // Automatically add the generated segment name as a tag if applicable
      if (res.data?.name || res.name) {
        setForm(f => ({ ...f, description: f.description ? `${f.description}\nTargeting: ${res.data?.name || res.name}` : `Targeting: ${res.data?.name || res.name}` }));
      }
    } catch (e) {
      console.error(e);
      setGeneratedSegment({ error: "Failed to generate audience." });
    } finally {
      setIsGeneratingSegment(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-800/50">
          <div>
            <h2 className="text-white text-lg font-semibold">Create New Offer</h2>
            <p className="text-gray-400 text-sm">Step {step} of 5: {STEPS[step - 1]}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="flex h-1 bg-gray-800">
          <div 
            className="bg-purple-600 transition-all duration-300"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in">
              <h3 className="text-white font-medium text-lg border-b border-gray-800 pb-2">Basic Info & Type</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-sm text-gray-400 block mb-1">Offer Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                    placeholder="e.g. Summer Sale 2026"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm text-gray-400 block mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                    placeholder="What is this offer for?"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Offer Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  >
                    <option value="percentage">Percentage Discount</option>
                    <option value="fixed">Fixed Amount Off</option>
                    <option value="points_multiplier">Points Multiplier</option>
                    <option value="free_product">Free Product</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Value</label>
                  <input
                    type="number"
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Start Date (Optional)</label>
                  <input
                    type="datetime-local"
                    value={form.validity_start}
                    onChange={(e) => setForm({ ...form, validity_start: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">End Date (Optional)</label>
                  <input
                    type="datetime-local"
                    value={form.validity_end}
                    onChange={(e) => setForm({ ...form, validity_end: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5 animate-in fade-in">
              <h3 className="text-white font-medium text-lg border-b border-gray-800 pb-2">Target Customers</h3>
              
              <div className="space-y-4">
                <div className="bg-gray-800 border border-gray-700 p-4 rounded-xl flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="target_all"
                    checked={form.target_all}
                    onChange={(e) => setForm({ ...form, target_all: e.target.checked })}
                    className="mt-1"
                  />
                  <div>
                    <label htmlFor="target_all" className="text-white font-medium block">All Customers</label>
                    <p className="text-gray-400 text-xs mt-0.5">Allow this offer to be claimed by anyone.</p>
                  </div>
                </div>

                {!form.target_all && (
                  <div className="space-y-4">
                    <div className="bg-gray-800 rounded-xl p-4 border border-purple-500/30">
                      <label className="text-sm text-purple-300 font-medium block mb-2 flex items-center gap-2">
                        <Sparkles size={14} /> Describe your target audience (AI)
                      </label>
                      <textarea
                        value={nlTarget}
                        onChange={(e) => setNlTarget(e.target.value)}
                        placeholder="e.g. Customers who bought shoes last month and spent over $100"
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 min-h-[80px]"
                      />
                      <button
                        type="button"
                        onClick={generateAudience}
                        disabled={isGeneratingSegment || !nlTarget}
                        className="mt-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                      >
                        {isGeneratingSegment ? "Analyzing Data..." : "Generate Audience"}
                      </button>

                      {generatedSegment && !generatedSegment.error && (
                        <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-green-400 font-medium text-sm">{generatedSegment.name}</span>
                            <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full">
                              {generatedSegment.size} matched
                            </span>
                          </div>
                          <p className="text-gray-400 text-xs">{generatedSegment.description}</p>
                        </div>
                      )}
                      {generatedSegment?.error && (
                        <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg">
                          {generatedSegment.error}
                        </div>
                      )}
                    </div>
                  </div>
                )}



                <div>
                  <label className="text-sm text-gray-400 block mb-2">Valid Channels</label>
                  <div className="flex flex-wrap gap-3">
                    {["email", "whatsapp", "sms", "auto"].map(ch => (
                      <label key={ch} className="flex items-center gap-2 text-gray-300 capitalize text-sm">
                        <input
                          type="checkbox"
                          checked={form.channels.includes(ch)}
                          onChange={() => handleChannelToggle(ch)}
                          className="rounded border-gray-600"
                        />
                        {ch === "auto" ? "Auto (Best converting channel)" : ch}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5 animate-in fade-in">
              <h3 className="text-white font-medium text-lg border-b border-gray-800 pb-2">Financial Controls</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Total Budget (Max spend allowed)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">₹</span>
                    <input
                      type="number"
                      value={form.total_budget}
                      onChange={(e) => setForm({ ...form, total_budget: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Leave 0 for unlimited budget.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Max Total Uses</label>
                    <input
                      type="number"
                      value={form.max_uses}
                      onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Total times this offer can be claimed across everyone.</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Uses Per Customer</label>
                    <input
                      type="number"
                      value={form.uses_per_customer}
                      onChange={(e) => setForm({ ...form, uses_per_customer: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5 animate-in fade-in">
              <h3 className="text-white font-medium text-lg border-b border-gray-800 pb-2">Coupon Configuration</h3>
              
              <div className="space-y-4">
                <div className="bg-gray-800 border border-gray-700 p-4 rounded-xl flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="auto_generate"
                    checked={form.auto_generate_codes}
                    onChange={(e) => setForm({ ...form, auto_generate_codes: e.target.checked })}
                    className="mt-1"
                  />
                  <div>
                    <label htmlFor="auto_generate" className="text-white font-medium block">Generate Unique Codes</label>
                    <p className="text-gray-400 text-xs mt-0.5">Automatically create unique suffix codes for each customer.</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-400 block mb-1">Base Code / Prefix</label>
                  <input
                    type="text"
                    value={form.code_prefix}
                    onChange={(e) => setForm({ ...form, code_prefix: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 font-mono uppercase"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {form.auto_generate_codes 
                      ? `Customers will receive codes like ${form.code_prefix || "OFFER"}-A1B2C3`
                      : `All customers will use the code ${form.code_prefix || "OFFER"}`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5 animate-in fade-in">
              <h3 className="text-white font-medium text-lg border-b border-gray-800 pb-2">Distribution & Finalize</h3>
              
              <div className="bg-purple-900/20 border border-purple-500/30 p-5 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-purple-300 font-medium pb-2 border-b border-purple-500/20">
                  <Check size={18} /> Offer Ready to Launch
                </div>
                
                <ul className="text-sm text-gray-300 space-y-2">
                  <li><strong>Offer:</strong> {form.name} ({form.type} - {form.value})</li>
                  <li><strong>Codes:</strong> {form.auto_generate_codes ? "Unique" : "Common"} ({form.code_prefix})</li>
                  <li><strong>Budget:</strong> {form.total_budget > 0 ? `₹${form.total_budget}` : "Unlimited"}</li>
                </ul>
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-2">Offer Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                >
                  <option value="draft">Save as Draft (Distribute later)</option>
                  <option value="active">Active (Ready for distribution)</option>
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  Once active, you can attach this offer to any automated Journey step or blast it in a Campaign segment.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-800 bg-gray-800/50 flex justify-between items-center">
          <button
            onClick={prevStep}
            disabled={step === 1}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white flex items-center gap-1 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
          >
            <ChevronLeft size={16} /> Back
          </button>
          
          {step < 5 ? (
            <button
              onClick={nextStep}
              className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors shadow-lg shadow-purple-900/20"
            >
              Continue <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!form.name || isPending}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-lg shadow-green-900/20 disabled:opacity-50"
            >
              {isPending ? "Creating..." : "Finish & Create Offer"}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
