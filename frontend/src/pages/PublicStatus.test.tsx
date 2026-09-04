import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { PublicStatus } from "./PublicStatus";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderAtSlug(slug: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/status/${slug}`]}>
        <Routes>
          <Route path="/status/:slug" element={<PublicStatus />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PublicStatus", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the overall status banner and each public monitor by name", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          overall_status: "UP",
          monitors: [
            {
              name: "Payments API",
              status: "UP",
              uptime_24h: 99.9,
              uptime_7d: 99.8,
              uptime_30d: 99.5,
              last_checked_at: new Date().toISOString(),
              recent_checks: [],
            },
          ],
          generated_at: new Date().toISOString(),
        }),
      ),
    );

    renderAtSlug("abc123");

    expect(await screen.findByText("All Systems Operational")).toBeInTheDocument();
    expect(screen.getByText("Payments API")).toBeInTheDocument();
  });

  it("never renders a monitor's target URL, only its name", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          overall_status: "DOWN",
          monitors: [
            {
              name: "Internal Auth Service",
              status: "DOWN",
              uptime_24h: 50,
              uptime_7d: 80,
              uptime_30d: 95,
              last_checked_at: new Date().toISOString(),
              recent_checks: [],
            },
          ],
          generated_at: new Date().toISOString(),
        }),
      ),
    );

    renderAtSlug("abc123");

    expect(await screen.findByText("Some Systems Are Down")).toBeInTheDocument();
    expect(screen.queryByText(/https?:\/\//)).not.toBeInTheDocument();
  });

  it("shows a not-found state for an unknown slug", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ error: { code: "STATUS_PAGE_NOT_FOUND", message: "Status page not found." } }, 404),
      ),
    );

    renderAtSlug("does-not-exist");

    expect(await screen.findByText("Status page not found")).toBeInTheDocument();
  });

  it("shows an empty state when the account has no public monitors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ overall_status: "UNKNOWN", monitors: [], generated_at: new Date().toISOString() }),
      ),
    );

    renderAtSlug("abc123");

    expect(await screen.findByText("Nothing is being shown here yet.")).toBeInTheDocument();
  });
});
