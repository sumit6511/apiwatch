import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { notificationsApi } from "../api/notifications";
import type { NotificationChannelCreateInput, NotificationChannelUpdateInput } from "../types";
import { queryKeys } from "./queryKeys";

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: notificationsApi.list,
  });
}

export function useCreateNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NotificationChannelCreateInput) => notificationsApi.create(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}

export function useUpdateNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: NotificationChannelUpdateInput }) =>
      notificationsApi.update(id, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.remove(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}

export function useTestNotification() {
  return useMutation({
    mutationFn: (id: string) => notificationsApi.test(id),
  });
}
