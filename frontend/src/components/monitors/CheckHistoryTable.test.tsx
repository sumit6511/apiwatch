import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { makeCheck } from "../../test-fixtures";
import { CheckHistoryTable } from "./CheckHistoryTable";

describe("CheckHistoryTable", () => {
  it("shows an empty message when there are no checks", () => {
    render(<CheckHistoryTable checks={[]} />);
    expect(screen.getByText("No checks recorded yet.")).toBeInTheDocument();
  });

  it("renders a row per check with status code and response time", () => {
    render(
      <CheckHistoryTable
        checks={[
          makeCheck({ id: "c1", status: "UP", http_status: 200, response_time_ms: 183 }),
          makeCheck({ id: "c2", status: "DOWN", http_status: 503, response_time_ms: 821, error: "Unexpected status code: 503" }),
        ]}
      />,
    );

    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText("183ms")).toBeInTheDocument();
    expect(screen.getByText("503")).toBeInTheDocument();
    expect(screen.getByText("821ms")).toBeInTheDocument();
    expect(screen.getByText("Unexpected status code: 503")).toBeInTheDocument();
  });
});
