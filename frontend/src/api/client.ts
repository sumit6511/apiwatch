import type { ApiErrorBody } from "../types";
import { clearStoredAccessKey, getStoredAccessKey, UNAUTHORIZED_EVENT } from "../lib/accessKey";
import { clearStoredUserToken, getStoredUserToken, USER_UNAUTHORIZED_EVENT } from "../lib/authToken";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const accessKey = getStoredAccessKey();
  const userToken = getStoredUserToken();

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        // Two independent gates, two independent headers (see backend
        // app/main.py): the shared deployment access key on Authorization,
        // this account's login session on X-User-Token.
        ...(accessKey ? { Authorization: `Bearer ${accessKey}` } : {}),
        ...(userToken ? { "X-User-Token": userToken } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Unable to reach the server. Please check your connection.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data: unknown = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const body = data as ApiErrorBody | undefined;
    const code = body?.error?.code ?? "UNKNOWN_ERROR";

    // Which of the two gates actually rejected this request -- inspect the
    // error *code*, not just the 401 status, since both failure modes are
    // 401s but need different UI (and must not clear each other's token).
    if (code === "UNAUTHORIZED") {
      clearStoredAccessKey();
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    } else if (code === "INVALID_SESSION") {
      clearStoredUserToken();
      window.dispatchEvent(new Event(USER_UNAUTHORIZED_EVENT));
    }

    throw new ApiError(response.status, code, body?.error?.message ?? "Something went wrong.");
  }

  return data as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
