import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { useRealtimeUpdates } from "./useRealtimeUpdates";
import { clearStoredAccessKey, setStoredAccessKey } from "../lib/accessKey";
import { clearStoredUserToken, setStoredUserToken } from "../lib/authToken";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.onclose?.();
  }
}

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useRealtimeUpdates", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
    setStoredAccessKey("test-access-key");
    setStoredUserToken("test-user-token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearStoredAccessKey();
    clearStoredUserToken();
  });

  it("sends stored credentials as the first message once the socket opens", async () => {
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useRealtimeUpdates(), { wrapper: makeWrapper(queryClient) });

    expect(result.current).toBe("connecting");
    const socket = MockWebSocket.instances[0];

    act(() => socket.onopen?.());

    expect(JSON.parse(socket.sent[0])).toEqual({ access_key: "test-access-key", user_token: "test-user-token" });
    await waitFor(() => expect(result.current).toBe("connected"));
  });

  it("invalidates monitors/incidents/dashboard queries (and nothing else) on a monitor_updated message", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    renderHook(() => useRealtimeUpdates(), { wrapper: makeWrapper(queryClient) });

    const socket = MockWebSocket.instances[0];
    act(() => socket.onopen?.());
    act(() => socket.onmessage?.({ data: JSON.stringify({ type: "monitor_updated", monitor_id: "m1" }) }));

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    const predicate = invalidateSpy.mock.calls[0][0]?.predicate as unknown as (q: { queryKey: unknown[] }) => boolean;
    expect(predicate({ queryKey: ["monitors"] })).toBe(true);
    expect(predicate({ queryKey: ["monitors", "m1", "checks", 100] })).toBe(true);
    expect(predicate({ queryKey: ["incidents"] })).toBe(true);
    expect(predicate({ queryKey: ["dashboard", "summary"] })).toBe(true);
    expect(predicate({ queryKey: ["notifications"] })).toBe(false);
  });

  it("ignores an unparseable message instead of throwing", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    renderHook(() => useRealtimeUpdates(), { wrapper: makeWrapper(queryClient) });

    const socket = MockWebSocket.instances[0];
    expect(() => act(() => socket.onmessage?.({ data: "not json" }))).not.toThrow();
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("reconnects after the socket closes", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useRealtimeUpdates(), { wrapper: makeWrapper(queryClient) });

    expect(MockWebSocket.instances).toHaveLength(1);
    act(() => MockWebSocket.instances[0].onclose?.());
    expect(result.current).toBe("disconnected");

    act(() => vi.advanceTimersByTime(3000));
    expect(MockWebSocket.instances).toHaveLength(2);

    vi.useRealTimers();
  });

  it("closes the socket and does not reconnect after unmount", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const queryClient = new QueryClient();
    const { unmount } = renderHook(() => useRealtimeUpdates(), { wrapper: makeWrapper(queryClient) });

    const socket = MockWebSocket.instances[0];
    const closeSpy = vi.spyOn(socket, "close");
    unmount();

    expect(closeSpy).toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(5000));
    expect(MockWebSocket.instances).toHaveLength(1);

    vi.useRealTimers();
  });
});
