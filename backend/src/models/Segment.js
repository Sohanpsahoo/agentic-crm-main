const mongoose = require("mongoose");

const segmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    criteria_nl: { type: String },
    criteria_json: { type: mongoose.Schema.Types.Mixed },
    customer_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: "Customer" }],
    size: { type: Number, default: 0 },
    created_by: { type: String, default: "user:manual" },
    last_refreshed_at: { type: Date },
    is_dynamic: { type: Boolean, default: false },
    agent_session_id: { type: String },
    persona_card: { type: mongoose.Schema.Types.Mixed }, // Stores generated Persona JSON
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

segmentSchema.index({ created_at: -1 });
segmentSchema.index({ size: -1 });

module.exports = mongoose.model("Segment", segmentSchema);
