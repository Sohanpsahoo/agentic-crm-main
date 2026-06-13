const mongoose = require("mongoose");

const MonitorAlertSchema = new mongoose.Schema(
  {
    campaign_id:  { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", required: true },
    campaign_name: { type: String, default: "" },
    channel:      { type: String, default: "whatsapp" },
    metric_failed: { type: String, default: "open_rate" }, // open_rate | ctr | conversion_rate
    actual_value:  { type: Number, default: 0 },
    expected_value: { type: Number, default: 0 },
    severity:     { type: String, enum: ["warning", "critical"], default: "warning" },
    ai_diagnosis: { type: String, default: "" },
    suggested_copy: { type: String, default: "" },
    recommended_action: { type: String, default: "resend_non_openers" },
    status:       { type: String, enum: ["pending", "applied", "dismissed"], default: "pending" },
    non_openers_count: { type: Number, default: 0 },
    applied_at:   { type: Date },
    applied_session_id: { type: String },
  },
  { timestamps: true }
);

MonitorAlertSchema.index({ status: 1, createdAt: -1 });
MonitorAlertSchema.index({ campaign_id: 1 });

module.exports = mongoose.model("MonitorAlert", MonitorAlertSchema);
