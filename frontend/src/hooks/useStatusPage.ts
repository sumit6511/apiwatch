import { useQuery } from "@tanstack/react-query";

import { statusPageApi } from "../api/statusPage";
import { queryKeys, REFRESH_INTERVAL_MS } from "./queryKeys";

export function usePublicStatusPage(slug: string) {
  return useQuery({
    queryKey: queryKeys.publicStatusPage(slug),
    queryFn: () => statusPageApi.get(slug),
    refetchInterval: REFRESH_INTERVAL_MS,
    retry: false,
  });
}
