import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { monitorsApi } from "../api/monitors";
import type { MonitorCreateInput, MonitorTestRequestInput, MonitorUpdateInput } from "../types";
import { queryKeys, REFRESH_INTERVAL_MS } from "./queryKeys";

export function useMonitors() {
  return useQuery({
    queryKey: queryKeys.monitors,
    queryFn: monitorsApi.list,
    refetchInterval: REFRESH_INTERVAL_MS,
  });
}

export function useMonitor(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.monitor(id ?? ""),
    queryFn: () => monitorsApi.get(id!),
    enabled: Boolean(id),
    refetchInterval: REFRESH_INTERVAL_MS,
  });
}

export function useCreateMonitor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MonitorCreateInput) => monitorsApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.monitors });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary });
    },
  });
}

export function useUpdateMonitor(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MonitorUpdateInput) => monitorsApi.update(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.monitors });
      void queryClient.invalidateQueries({ queryKey: queryKeys.monitor(id) });
    },
  });
}

export function useDeleteMonitor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => monitorsApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.monitors });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary });
      void queryClient.invalidateQueries({ queryKey: queryKeys.incidents });
    },
  });
}

export function usePauseMonitor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => monitorsApi.pause(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.monitors });
      void queryClient.invalidateQueries({ queryKey: queryKeys.monitor(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary });
    },
  });
}

export function useResumeMonitor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => monitorsApi.resume(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.monitors });
      void queryClient.invalidateQueries({ queryKey: queryKeys.monitor(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary });
    },
  });
}

export function useRunManualCheck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => monitorsApi.runCheck(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.monitors });
      // Covers monitor detail, checks, metrics, and uptime for this monitor
      // in one go -- they all share the ["monitors", id, ...] key prefix.
      void queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "monitors" && q.queryKey[1] === id,
      });
    },
  });
}

export function useTestRequest() {
  return useMutation({
    mutationFn: (input: MonitorTestRequestInput) => monitorsApi.testRequest(input),
  });
}
