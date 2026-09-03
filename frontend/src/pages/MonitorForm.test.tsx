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
});
