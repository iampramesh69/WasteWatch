const API_BASE = "/api";
async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}
export const api = {
  health: () => request("/health"),
  me: () => request("/auth/me"),
  login: (credentials) =>
    request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    }),
  register: (details) =>
    request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(details),
    }),
  logout: () => request("/auth/logout", { method: "POST" }),
  reports: (filters = {}) => {
    const qs = new URLSearchParams(filters);
    return request(`/reports?${qs}`);
  },
  report: (id) => request(`/reports/${encodeURIComponent(id)}`),
  createReport: (formData) =>
    request("/reports", { method: "POST", body: formData }),
  updateReport: (id, formData) =>
    request(`/reports/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: formData,
    }),
  deleteReport: (id) =>
    request(`/reports/${encodeURIComponent(id)}`, { method: "DELETE" }),
  seedDemo: () => request("/demo/seed", { method: "POST" }),
  clearDemo: () => request("/demo", { method: "DELETE" }),
};
