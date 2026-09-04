import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { getStoredAccessKey } from "../lib/accessKey";
import { getStoredUserToken } from "../lib/authToken";

export type RealtimeStatus = "connecting" | "connected" | "disconnected";

const RECONNECT_DELAY_MS = 3000;

// Same keys a poll refetch would touch (see hooks/queryKeys.ts) -- a single
// "monitor_updated" event doesn't say exactly what changed (status, a new
// check, an opened/resolved incident), so it just invalidates everything a
// check completing could have affected and lets each mounted query's normal
// fetch path pull the fresh data.
const INVALIDATE_PREFIXES = new Set(["monitors", "incidents", "dashboard"]);

function wsUrl(): string {
  const apiUrl: string = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
  return `${apiUrl.replace(/^http/, "ws")}/ws/updates`;
}

/** Live push for monitor/check/incident changes, on top of (not instead of)
 * the existing REFRESH_INTERVAL_MS poll -- that stays as a fallback in case
 * the socket is down, so a dropped connection degrades to "up to 30s stale"
 * rather than "stuck". Mount exactly once, at the authenticated app root
 * (AppShell) -- not per-component -- so there's a single connection per
 * session rather than one per mounted hook. */
export function useRealtimeUpdates(): RealtimeStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>("connecting");

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      setStatus("connecting");
      socket = new WebSocket(wsUrl());

      socket.onopen = () => {
        socket?.send(
          JSON.stringify({
            access_key: getStoredAccessKey() ?? "",
            user_token: getStoredUserToken() ?? "",
          }),
        );
        setStatus("connected");
      };

      socket.onmessage = (event: MessageEvent<string>) => {
        let message: { type?: string } = {};
        try {
          message = JSON.parse(event.data) as { type?: string };
        } catch {
          return;
        }
        if (message.type === "monitor_updated") {
          void queryClient.invalidateQueries({
            predicate: (q) => INVALIDATE_PREFIXES.has(q.queryKey[0] as string),
          });
        }
      };

      socket.onclose = () => {
        setStatus("disconnected");
        if (cancelled) return;
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };

      socket.onerror = () => {
        socket?.close();
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [queryClient]);

  return status;
}
