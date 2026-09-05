import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Select } from "./Select";

const OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "name", label: "Name (A-Z)" },
];

// aria-label wins over visible text content for a button's accessible
// name, so the trigger is found by its field label ("Sort"), not by
// whatever value currently happens to be showing -- the same as a native
// <select> with an associated <label>, whose accessible name comes from
// the label, not the selected <option> text.
describe("Select", () => {
  it("shows the selected option's label as the trigger's visible text", () => {
    render(<Select value="name" onChange={vi.fn()} options={OPTIONS} ariaLabel="Sort" />);
    expect(within(screen.getByRole("button", { name: "Sort" })).getByText("Name (A-Z)")).toBeInTheDocument();
  });

  it("opens a listbox of every option on click", async () => {
    render(<Select value="newest" onChange={vi.fn()} options={OPTIONS} ariaLabel="Sort" />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Sort" }));

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Newest first" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Name (A-Z)" })).toBeInTheDocument();
  });

  it("marks the current value as the selected option", async () => {
    render(<Select value="name" onChange={vi.fn()} options={OPTIONS} ariaLabel="Sort" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Sort" }));

    expect(screen.getByRole("option", { name: "Name (A-Z)" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "Newest first" })).toHaveAttribute("aria-selected", "false");
  });

  it("calls onChange and closes the popup when an option is clicked", async () => {
    const onChange = vi.fn();
    render(<Select value="newest" onChange={onChange} options={OPTIONS} ariaLabel="Sort" />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Sort" }));
    await user.click(screen.getByRole("option", { name: "Name (A-Z)" }));

    expect(onChange).toHaveBeenCalledWith("name");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes on Escape without calling onChange", async () => {
    const onChange = vi.fn();
    render(<Select value="newest" onChange={onChange} options={OPTIONS} ariaLabel="Sort" />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Sort" }));
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes when clicking outside", async () => {
    render(
      <div>
        <Select value="newest" onChange={vi.fn()} options={OPTIONS} ariaLabel="Sort" />
        <button type="button">Outside</button>
      </div>,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Sort" }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
