import api from "./api";

const personasApi = {
  list: (segment, page = 1) =>
    api.get("/personas", { params: { segment: segment || undefined, page } }).then((r) => r.data),
  get: (customerId) => api.get(`/personas/${customerId}`).then((r) => r.data),
  compute: () => new Promise(resolve => setTimeout(() => resolve(api.post("/personas/compute").then((r) => r.data)), 2000)),
  aiDecisions: (limit = 50, action) =>
    api.get("/personas/ai-decisions", { params: { limit, action: action || undefined } }).then((r) => r.data),
  stats: () => api.get("/personas/stats").then((r) => r.data),
  distribution: () => api.get("/analytics/rfm-distribution").then((r) => r.data),
};

export default personasApi;
