import { apiClient } from "./client";
import type { DashboardSummary } from "../types";

export const dashboardApi = {
  summary: () => apiClient.get<DashboardSummary>("/api/dashboard/summary"),
};
