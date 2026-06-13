const mongoose = require("mongoose");

const toolCallSchema = new mongoose.Schema(
  {
    tool: String,
    args: { type: mongoose.Schema.Types.Mixed },
    result_summary: String,
  },
  { _id: false }
);

const agentLogSchema = new mongoose.Schema(
  {
    session_id: { type: String, required: true },
    agent_name: { type: String, required: true },
    step: { type: String },
    input_summary: { type: String },
    output_summary: { type: String },
    tools_called: [toolCallSchema],
    llm_calls: { type: Number, default: 0 },
    tokens_used: { type: Number, default: 0 },
    duration_ms: { type: Number, default: 0 },
    error: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

agentLogSchema.index({ session_id: 1, timestamp: -1 });
agentLogSchema.index({ agent_name: 1 });

module.exports = mongoose.model("AgentLog", agentLogSchema);
