import { apiClient } from "./client";
import type { Check, MetricPoint, Period, UptimeStats } from "../types";

export const checksApi = {
  list: (monitorId: string, limit = 50) =>
    apiClient.get<Check[]>(`/api/monitors/${monitorId}/checks?limit=${limit}`),
  metrics: (monitorId: string, period: Period) =>
    apiClient.get<MetricPoint[]>(`/api/monitors/${monitorId}/metrics?period=${period}`),
  uptime: (monitorId: string, period: Period) =>
    apiClient.get<UptimeStats>(`/api/monitors/${monitorId}/uptime?period=${period}`),
};
