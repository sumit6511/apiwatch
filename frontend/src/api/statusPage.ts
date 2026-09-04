import { publicGet } from "./client";
import type { PublicStatusPage } from "../types";

export const statusPageApi = {
  get: (slug: string) => publicGet<PublicStatusPage>(`/api/public/status/${slug}`),
};
