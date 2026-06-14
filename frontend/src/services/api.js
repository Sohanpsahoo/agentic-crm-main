import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  timeout: 90000,
});

export const customersApi = {
  list: (params) => api.get("/customers", { params }),
  get: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post("/customers", data),
  import: (customers) => api.post("/customers/import", { customers }),
  getOrders: (id) => api.get(`/customers/${id}/orders`),
};

export const campaignsApi = {
  list: (params) => api.get("/campaigns", { params }),
  get: (id) => api.get(`/campaigns/${id}`),
  create: (data) => api.post("/campaigns", data),
  getAnalytics: (id) => api.get(`/campaigns/${id}/analytics`),
  getCommunications: (id, params) => api.get(`/campaigns/${id}/communications`, { params }),
  updateStatus: (id, status) => api.patch(`/campaigns/${id}/status`, { status }),
  send: (id) => api.post(`/campaigns/${id}/send`),
  retryDLQ: () => api.post(`/campaigns/retry-dlq`),
};

export const segmentsApi = {
  list: () => api.get("/segments"),
  get: (id) => api.get(`/segments/${id}`),
  create: (data) => api.post("/segments", data),
  generate: (query) => api.post("/segments/generate", { query }),
  estimate: (query) => api.post("/segments/estimate", { query }),
  getCustomers: (id, params) => api.get(`/segments/${id}/customers`, { params }),
  refresh: (id) => api.post(`/segments/${id}/refresh`),
  generatePersona: (id) => api.post(`/segments/${id}/generate-persona`),
  update: (id, data) => api.patch(`/segments/${id}`, data),
  delete: (id) => api.delete(`/segments/${id}`),
};

export const analyticsApi = {
  overview: () => api.get("/analytics/overview"),
  campaigns: (params) => api.get("/analytics/campaigns", { params }),
  channelPerformance: () => api.get("/analytics/channel-performance"),
  roi: () => api.get("/analytics/roi"),
  rfmDistribution: () => api.get("/analytics/rfm-distribution"),
  businessKpis: () => api.get("/analytics/business-kpis"),
};

export const agentApi = {
  runTask: (query, context) => api.post("/agent/task", { query, context }),
  getTask: (sessionId) => api.get(`/agent/task/${sessionId}`),
  resumeTask: (sessionId, approved) => api.post(`/agent/task/${sessionId}/resume`, { approved }),
  stats: () => api.get("/agent/stats"),
  chat: (message, history, customerName) => api.post("/agent/chat", { message, history, customer_name: customerName }),
  getCommunications: (params) => api.get("/agent/communications", { params }),
  ideate: (context) => api.post("/agent/ideate", { context }),
  segmentPreview: (query) => api.post("/agent/segment-preview", { query }),
  messagePreview: (goal, channel, audience_desc) => api.post("/agent/message-preview", { goal, channel, audience_desc }),
  blastSegment: (segmentId, messageTemplate, channel, delaySeconds) => api.post("/agent/blast-segment", { segment_id: segmentId, message_template: messageTemplate, channel, delay_seconds: delaySeconds }),
};

export const offersApi = {
  list: (status) => api.get("/offers", { params: status ? { status } : {} }).then((r) => r.data),
  get: (id) => api.get(`/offers/${id}`).then((r) => r.data),
  create: (data) => api.post("/offers", data).then((r) => r.data),
  generateCodes: (id, customerIds) => api.post(`/offers/${id}/generate-codes`, { customer_ids: customerIds }).then((r) => r.data),
  validate: (id, code, customerId) => api.post(`/offers/${id}/validate`, { code, customer_id: customerId }).then((r) => r.data),
  setStatus: (id, status) => api.patch(`/offers/${id}/status`, { status }).then((r) => r.data),
};

export const journeysApi = {
  list: (status) => api.get("/journeys", { params: status ? { status } : {} }).then((r) => r.data),
  get: (id) => api.get(`/journeys/${id}`).then((r) => r.data),
  create: (data) => api.post("/journeys", data).then((r) => r.data),
  enroll: (id, customerId) => api.post(`/journeys/${id}/enroll`, { customer_id: customerId }).then((r) => r.data),
  setStatus: (id, status) => api.patch(`/journeys/${id}/status`, { status }).then((r) => r.data),
  addStep: (id, stepData) => api.post(`/journeys/${id}/steps`, stepData).then((r) => r.data),
};

export const productsApi = {
  list: (params) => api.get("/products", { params }).then((r) => r.data),
  create: (data) => api.post("/products", data).then((r) => r.data),
  import: (products) => api.post("/products/import", { products }).then((r) => r.data),
  recommend: (customerId) => api.get(`/products/recommend/${customerId}`).then((r) => r.data),
};

export const whatsappApi = {
  status: () => api.get("/whatsapp/status"),
  qr: () => api.get("/whatsapp/qr"),
  disconnect: () => api.post("/whatsapp/disconnect"),
};

export const monitorApi = {
  alerts: (params) => api.get("/monitor/alerts", { params }),
  run: () => api.post("/monitor/run"),
  apply: (id) => api.post(`/monitor/alerts/${id}/apply`),
  dismiss: (id) => api.patch(`/monitor/alerts/${id}/dismiss`),
};

export default api;
