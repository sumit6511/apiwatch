import { useQuery } from "@tanstack/react-query";

import { incidentsApi } from "../api/incidents";
import { queryKeys, REFRESH_INTERVAL_MS } from "./queryKeys";

export function useMonitorIncidents(monitorId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.monitorIncidents(monitorId ?? ""),
    queryFn: () => incidentsApi.listForMonitor(monitorId!),
    enabled: Boolean(monitorId),
    refetchInterval: REFRESH_INTERVAL_MS,
  });
}

export function useAllIncidents() {
  return useQuery({
    queryKey: queryKeys.incidents,
    queryFn: incidentsApi.listAll,
    refetchInterval: REFRESH_INTERVAL_MS,
  });
}
