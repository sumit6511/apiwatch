import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { accountApi } from "../api/account";
import { queryKeys } from "./queryKeys";

export function useStatusPageSlug() {
  return useQuery({
    queryKey: queryKeys.statusPageSlug,
    queryFn: accountApi.getStatusPageSlug,
  });
}

export function useRegenerateStatusPageSlug() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: accountApi.regenerateStatusPageSlug,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.statusPageSlug, data);
    },
  });
}
