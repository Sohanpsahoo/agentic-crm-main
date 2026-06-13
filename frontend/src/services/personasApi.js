import axios from "axios";

const api = axios.create({ baseURL: "/api", timeout: 30000 });

const personasApi = {
  list: (segment, page = 1) =>
    api.get("/personas", { params: { segment: segment || undefined, page } }).then((r) => r.data),
  get: (customerId) => api.get(`/personas/${customerId}`).then((r) => r.data),
  compute: () => api.post("/personas/compute").then((r) => r.data),
  aiDecisions: (limit = 50, action) =>
    api.get("/personas/ai-decisions", { params: { limit, action: action || undefined } }).then((r) => r.data),
  stats: () => api.get("/personas/stats").then((r) => r.data),
  distribution: () => api.get("/analytics/rfm-distribution").then((r) => r.data),
};

export default personasApi;
