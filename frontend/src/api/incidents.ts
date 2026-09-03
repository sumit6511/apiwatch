import { apiClient } from "./client";
import type { Incident } from "../types";

export const incidentsApi = {
  listForMonitor: (monitorId: string) =>
    apiClient.get<Incident[]>(`/api/monitors/${monitorId}/incidents`),
  listAll: () => apiClient.get<Incident[]>("/api/incidents"),
};
