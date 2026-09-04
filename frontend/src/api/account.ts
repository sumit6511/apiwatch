import { apiClient } from "./client";
import type { StatusPageSlug } from "../types";

export const accountApi = {
  getStatusPageSlug: () => apiClient.get<StatusPageSlug>("/api/account/status-page"),
  regenerateStatusPageSlug: () => apiClient.post<StatusPageSlug>("/api/account/status-page/regenerate"),
};
