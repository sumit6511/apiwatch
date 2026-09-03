import { apiClient } from "./client";
import type {
  NotificationChannel,
  NotificationChannelCreateInput,
  NotificationChannelUpdateInput,
  NotificationTestResult,
} from "../types";

export const notificationsApi = {
  list: () => apiClient.get<NotificationChannel[]>("/api/notifications"),
  create: (input: NotificationChannelCreateInput) =>
    apiClient.post<NotificationChannel>("/api/notifications", input),
  update: (id: string, input: NotificationChannelUpdateInput) =>
    apiClient.patch<NotificationChannel>(`/api/notifications/${id}`, input),
  remove: (id: string) => apiClient.delete<void>(`/api/notifications/${id}`),
  test: (id: string) => apiClient.post<NotificationTestResult>(`/api/notifications/${id}/test`),
};
