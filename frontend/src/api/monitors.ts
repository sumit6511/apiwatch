import { apiClient } from "./client";
import type {
  ManualCheckResult,
  Monitor,
  MonitorCreateInput,
  MonitorTestRequestInput,
  MonitorUpdateInput,
} from "../types";

export const monitorsApi = {
  list: () => apiClient.get<Monitor[]>("/api/monitors"),
  get: (id: string) => apiClient.get<Monitor>(`/api/monitors/${id}`),
  create: (input: MonitorCreateInput) => apiClient.post<Monitor>("/api/monitors", input),
  update: (id: string, input: MonitorUpdateInput) =>
    apiClient.patch<Monitor>(`/api/monitors/${id}`, input),
  remove: (id: string) => apiClient.delete<void>(`/api/monitors/${id}`),
  pause: (id: string) => apiClient.post<Monitor>(`/api/monitors/${id}/pause`),
  resume: (id: string) => apiClient.post<Monitor>(`/api/monitors/${id}/resume`),
  runCheck: (id: string) => apiClient.post<ManualCheckResult>(`/api/monitors/${id}/check`),
  testRequest: (input: MonitorTestRequestInput) =>
    apiClient.post<ManualCheckResult>("/api/monitors/test-request", input),
};
