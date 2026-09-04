import type { Period } from "../types";

export const queryKeys = {
  monitors: ["monitors"] as const,
  monitor: (id: string) => ["monitors", id] as const,
  checks: (id: string, limit: number) => ["monitors", id, "checks", limit] as const,
  metrics: (id: string, period: Period) => ["monitors", id, "metrics", period] as const,
  uptime: (id: string, period: Period) => ["monitors", id, "uptime", period] as const,
  monitorIncidents: (id: string) => ["monitors", id, "incidents"] as const,
  incidents: ["incidents"] as const,
  notifications: ["notifications"] as const,
  dashboardSummary: ["dashboard", "summary"] as const,
  statusPageSlug: ["account", "status-page"] as const,
  publicStatusPage: (slug: string) => ["public-status-page", slug] as const,
};

export const REFRESH_INTERVAL_MS = (() => {
  const seconds = Number(import.meta.env.VITE_MONITOR_REFRESH_SECONDS) || 30;
  return seconds * 1000;
})();
