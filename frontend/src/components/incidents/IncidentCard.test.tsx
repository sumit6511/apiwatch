import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";

import { renderWithProviders } from "../../test-utils";
import { makeIncident } from "../../test-fixtures";
import { IncidentCard } from "./IncidentCard";

describe("IncidentCard", () => {
  it("shows Open for an unresolved incident", () => {
    renderWithProviders(<IncidentCard incident={makeIncident({ status: "OPEN", resolved_at: null })} />);
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("HTTP 503")).toBeInTheDocument();
  });

  it("shows Resolved and a duration for a resolved incident", () => {
    renderWithProviders(
      <IncidentCard
        incident={makeIncident({
          status: "RESOLVED",
          resolved_at: new Date().toISOString(),
          duration_seconds: 272,
        })}
      />,
    );
    expect(screen.getByText("Resolved")).toBeInTheDocument();
    expect(screen.getByText("4m 32s")).toBeInTheDocument();
  });

  it("links to the monitor when showMonitorName is set", () => {
    renderWithProviders(
      <IncidentCard incident={makeIncident({ monitor_name: "GitHub API" })} showMonitorName />,
    );
    const link = screen.getByRole("link", { name: "GitHub API" });
    expect(link).toHaveAttribute("href", "/monitors/monitor-1");
  });
});
