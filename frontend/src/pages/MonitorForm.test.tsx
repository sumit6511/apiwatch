import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "../test-utils";
import { MonitorForm } from "./MonitorForm";

function mockFetchOk(body: unknown = []) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
}

describe("MonitorForm (create mode)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetchOk([]));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("blocks submission and shows a validation error for a non-http(s) URL", async () => {
    const fetchMock = mockFetchOk([]);
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders(<MonitorForm mode="create" />, { route: "/monitors/new" });

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Monitor Name"), "Bad Monitor");
    await user.type(screen.getByLabelText("URL"), "ftp://example.com");
    await user.click(screen.getByRole("button", { name: "Create Monitor" }));

    expect(await screen.findByText("URL must start with http:// or https://.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((call: unknown[]) => String(call[0]).endsWith("/api/monitors"))).toBe(
      false,
    );
  });

  it("requires at least one expected status code", async () => {
    renderWithProviders(<MonitorForm mode="create" />, { route: "/monitors/new" });

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Monitor Name"), "My API");
    await user.type(screen.getByLabelText("URL"), "https://api.example.com");
    const statusCodesInput = screen.getByLabelText("Expected Status Codes");
    await user.clear(statusCodesInput);
    await user.click(screen.getByRole("button", { name: "Create Monitor" }));

    expect(await screen.findByText("At least one expected status code is required.")).toBeInTheDocument();
  });

  it("includes is_public: true in the create payload when the visibility checkbox is checked", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } })) // notifications list
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "m1",
            name: "My API",
            url: "https://api.example.com",
            method: "GET",
            headers: {},
            body: null,
            interval_seconds: 300,
            timeout_seconds: 10,
            expected_status_codes: [200],
            notification_channel_ids: [],
            is_public: true,
            is_active: true,
            status: "UNKNOWN",
            http_status: null,
            response_time_ms: null,
            failure_count: 0,
            success_count: 0,
            last_checked_at: null,
            last_success_at: null,
            last_failure_at: null,
            uptime: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        ),
      ); // create response
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders(<MonitorForm mode="create" />, { route: "/monitors/new" });

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Monitor Name"), "My API");
    await user.type(screen.getByLabelText("URL"), "https://api.example.com");
    await user.click(screen.getByLabelText(/Show on public status page/));
    await user.click(screen.getByRole("button", { name: "Create Monitor" }));

    await vi.waitFor(() => {
      const createCall = fetchMock.mock.calls.find(
        (call: unknown[]) => String(call[0]).endsWith("/api/monitors") && (call[1] as RequestInit)?.method === "POST",
      );
      expect(createCall).toBeDefined();
      const body = JSON.parse((createCall![1] as RequestInit).body as string);
      expect(body.is_public).toBe(true);
    });
  });
});
