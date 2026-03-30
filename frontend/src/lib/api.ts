import type {
  DashboardStats, GraphData, FraudRing, Company, EntityDetail, ExplainResult
} from "./types";

const BASE = "/api";

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.json();
}

export const api = {
  stats:       (period?: string) => fetchJSON<DashboardStats>(`${BASE}/dashboard-stats${period ? `?period=${period}` : ''}`),
  graph:       (period?: string) => fetchJSON<GraphData>(`${BASE}/graph${period ? `?period=${period}` : ''}`),
  companies:   (period?: string) => fetchJSON<Company[]>(`${BASE}/companies${period ? `?period=${period}` : ''}`),
  rings:       (period?: string) => fetchJSON<FraudRing[]>(`${BASE}/fraud-rings${period ? `?period=${period}` : ''}`),
  anomalies:   (period?: string) => fetchJSON<Company[]>(`${BASE}/anomalies${period ? `?period=${period}` : ''}`),
  company:     (gstin: string, period?: string) => fetchJSON<EntityDetail>(`${BASE}/company/${gstin}${period ? `?period=${period}` : ''}`),
  refresh:     (period?: string) => fetch(`${BASE}/refresh${period ? `?period=${period}` : ''}`, { method: "POST" }).then(r => r.json()),
  explain:     (gstin: string, period?: string) =>
    fetch(`${BASE}/explain${period ? `?period=${period}` : ''}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gstin }),
    }).then(r => r.json()) as Promise<ExplainResult>,
  ingest: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/ingest`, { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
  },
  
  // Upload history
  uploadHistory: (limit?: number) => 
    fetchJSON<{ history: any[] }>(`${BASE}/upload-history${limit ? `?limit=${limit}` : ""}`),
  
  // Database management
  createSnapshot: () => 
    fetch(`${BASE}/snapshot`, { method: "POST" }).then(r => r.json()),
  
  listSnapshots: () => 
    fetchJSON<{ snapshots: any[] }>(`${BASE}/snapshots`),
  
  restoreSnapshot: (snapshotId: string) => 
    fetch(`${BASE}/restore/${snapshotId}`, { method: "POST" }).then(r => r.json()),
  
  clearData: (clearCompanies = false, clearHistory = false) => 
    fetch(`${BASE}/clear-data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        confirmation: "CLEAR_ALL_DATA",
        clear_companies: clearCompanies,
        clear_history: clearHistory
      })
    }).then(r => r.json()),
};

export function fmtCurrency(v: number) {
  if (v >= 1_00_00_000) return `₹${(v / 1_00_00_000).toFixed(2)} Cr`;
  if (v >= 1_00_000)    return `₹${(v / 1_00_000).toFixed(2)} L`;
  return `₹${v.toLocaleString("en-IN")}`;
}

export function scoreColor(score: number) {
  if (score >= 86) return "var(--red)";
  if (score >= 61) return "var(--orange)";
  if (score >= 31) return "var(--yellow)";
  return "var(--green)";
}

export function riskClass(level: string) {
  return `badge badge--${level.toLowerCase()}`;
}
