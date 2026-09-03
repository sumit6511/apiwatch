import { useQuery } from "@tanstack/react-query";

import { dashboardApi } from "../api/dashboard";
import { queryKeys, REFRESH_INTERVAL_MS } from "./queryKeys";

export function useDashboardSummary() {
  return useQuery({
    queryKey: queryKeys.dashboardSummary,
    queryFn: dashboardApi.summary,
    refetchInterval: REFRESH_INTERVAL_MS,
  });
}
