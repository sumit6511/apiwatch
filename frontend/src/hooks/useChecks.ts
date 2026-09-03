import { useQuery } from "@tanstack/react-query";

import { checksApi } from "../api/checks";
import type { Period } from "../types";
import { queryKeys, REFRESH_INTERVAL_MS } from "./queryKeys";

export function useChecks(monitorId: string | undefined, limit = 50) {
  return useQuery({
    queryKey: queryKeys.checks(monitorId ?? "", limit),
    queryFn: () => checksApi.list(monitorId!, limit),
    enabled: Boolean(monitorId),
    refetchInterval: REFRESH_INTERVAL_MS,
  });
}

export function useMetrics(monitorId: string | undefined, period: Period) {
  return useQuery({
    queryKey: queryKeys.metrics(monitorId ?? "", period),
    queryFn: () => checksApi.metrics(monitorId!, period),
    enabled: Boolean(monitorId),
    refetchInterval: REFRESH_INTERVAL_MS,
  });
}

export function useUptime(monitorId: string | undefined, period: Period) {
  return useQuery({
    queryKey: queryKeys.uptime(monitorId ?? "", period),
    queryFn: () => checksApi.uptime(monitorId!, period),
    enabled: Boolean(monitorId),
    refetchInterval: REFRESH_INTERVAL_MS,
  });
}
