import { apiClient } from "./client";
import type { TokenResponse, User } from "../types";

export const authApi = {
  signup: (email: string, password: string) =>
    apiClient.post<TokenResponse>("/api/auth/signup", { email, password }),
  login: (email: string, password: string) =>
    apiClient.post<TokenResponse>("/api/auth/login", { email, password }),
  me: () => apiClient.get<User>("/api/auth/me"),
};
