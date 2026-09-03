import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { StatusBadge, StatusIndicator } from "./Status";

describe("StatusBadge", () => {
  it.each([
    ["UP", "Operational"],
    ["DOWN", "Down"],
    ["PAUSED", "Paused"],
    ["UNKNOWN", "Pending"],
  ] as const)("renders visible text for %s, not color alone", (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

describe("StatusIndicator", () => {
  it("shows the status label alongside the dot", () => {
    render(<StatusIndicator status="DOWN" />);
    expect(screen.getByText("Down")).toBeInTheDocument();
  });
});
