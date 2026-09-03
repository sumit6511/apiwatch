import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { MetricCard } from "./MetricCard";

describe("MetricCard", () => {
  it("renders the label and value", () => {
    render(<MetricCard label="Monitors" value={12} />);
    expect(screen.getByText("Monitors")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("renders non-numeric values such as formatted percentages", () => {
    render(<MetricCard label="Overall Uptime" value="99.92%" />);
    expect(screen.getByText("99.92%")).toBeInTheDocument();
  });
});
