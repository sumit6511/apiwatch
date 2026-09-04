import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "../test-utils";
import { makeMonitor } from "../test-fixtures";
import { Dashboard } from "./Dashboard";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const SUMMARY = {
  total_monitors: 2,
  operational: 2,
  down: 0,
  paused: 0,
  overall_uptime_percentage: 100,
};

function mockFetchByUrl(monitors: unknown[]) {
  return vi.fn((url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (String(url).includes("/api/dashboard/summary")) return Promise.resolve(jsonResponse(SUMMARY));
    // A 204 response can't carry a body -- the Response constructor throws
    // if you try (JSON.stringify(null) is still a non-null body).
    if (String(url).includes("/api/monitors") && method === "DELETE")
      return Promise.resolve(new Response(null, { status: 204 }));
    if (String(url).endsWith("/api/monitors")) return Promise.resolve(jsonResponse(monitors));
    return Promise.resolve(jsonResponse([]));
  });
}

describe("Dashboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("filters the monitor list by tag", async () => {
    const monitors = [
      makeMonitor({ id: "m1", name: "Prod API", tags: ["prod"] }),
      makeMonitor({ id: "m2", name: "Staging API", tags: ["staging"] }),
    ];
    vi.stubGlobal("fetch", mockFetchByUrl(monitors));

    renderWithProviders(<Dashboard />);
    await screen.findByText("Prod API");
    expect(screen.getByText("Staging API")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Filter by tag"), "prod");

    expect(screen.getByText("Prod API")).toBeInTheDocument();
    expect(screen.queryByText("Staging API")).not.toBeInTheDocument();
  });

  it("clicking Select switches to list view, and bulk delete removes only the checked monitors", async () => {
    const monitors = [
      makeMonitor({ id: "m1", name: "Keep Me" }),
      makeMonitor({ id: "m2", name: "Delete Me" }),
    ];
    const fetchMock = mockFetchByUrl(monitors);
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders(<Dashboard />);
    await screen.findByText("Keep Me");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Select monitors" }));

    const deleteRow = screen.getByText("Delete Me").closest("div.card-interactive") as HTMLElement;
    await user.click(within(deleteRow).getByLabelText("Select Delete Me"));

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await screen.findByText("1 monitor deleted");

    const deleteCall = fetchMock.mock.calls.find(
      (call: unknown[]) => String(call[0]).includes("/api/monitors/m2") && (call[1] as RequestInit)?.method === "DELETE",
    );
    expect(deleteCall).toBeDefined();
    const otherDeleteCall = fetchMock.mock.calls.find(
      (call: unknown[]) => String(call[0]).includes("/api/monitors/m1") && (call[1] as RequestInit)?.method === "DELETE",
    );
    expect(otherDeleteCall).toBeUndefined();
  });
});
