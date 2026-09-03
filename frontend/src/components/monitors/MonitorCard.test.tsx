import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "../../test-utils";
import { makeMonitor } from "../../test-fixtures";
import { MonitorCard } from "./MonitorCard";

function mockFetchOk(body: unknown = []) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
}

describe("MonitorCard", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetchOk([]));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the monitor name, status, url, and response time", async () => {
    const monitor = makeMonitor({ name: "GitHub API", status: "UP", http_status: 200, response_time_ms: 183 });
    renderWithProviders(<MonitorCard monitor={monitor} />);

    expect(screen.getByText("GitHub API")).toBeInTheDocument();
    expect(screen.getByText("Operational")).toBeInTheDocument();
    expect(screen.getByText("https://api.github.com")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText("183ms")).toBeInTheDocument();
  });

  it("shows a Pause action for an active monitor and calls the pause endpoint", async () => {
    const fetchMock = mockFetchOk([]);
    vi.stubGlobal("fetch", fetchMock);

    const monitor = makeMonitor({ id: "m-42", is_active: true });
    renderWithProviders(<MonitorCard monitor={monitor} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: `Actions for ${monitor.name}` }));

    const menu = screen.getByRole("menu");
    await user.click(within(menu).getByText("Pause"));

    await waitFor(() => {
      const pauseCall = fetchMock.mock.calls.find((call: unknown[]) => String(call[0]).includes("/pause"));
      expect(pauseCall).toBeDefined();
      expect(pauseCall![1]).toMatchObject({ method: "POST" });
    });
  });

  it("shows a Resume action when the monitor is paused", async () => {
    const monitor = makeMonitor({ is_active: false, status: "PAUSED" });
    renderWithProviders(<MonitorCard monitor={monitor} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: `Actions for ${monitor.name}` }));
    expect(within(screen.getByRole("menu")).getByText("Resume")).toBeInTheDocument();
  });
});
