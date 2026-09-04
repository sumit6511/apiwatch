import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TagsInput } from "./TagsInput";

describe("TagsInput", () => {
  it("adds a tag on Enter and clears the draft", async () => {
    const onChange = vi.fn();
    render(<TagsInput tags={[]} onChange={onChange} />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText("Add a tag…"), "prod{Enter}");

    expect(onChange).toHaveBeenCalledWith(["prod"]);
  });

  it("adds a tag on comma", async () => {
    const onChange = vi.fn();
    render(<TagsInput tags={[]} onChange={onChange} />);
    const user = userEvent.setup();

    await user.type(screen.getByRole("textbox"), "api,");

    expect(onChange).toHaveBeenCalledWith(["api"]);
  });

  it("does not add a duplicate tag (case-insensitive)", async () => {
    const onChange = vi.fn();
    render(<TagsInput tags={["prod"]} onChange={onChange} />);
    const user = userEvent.setup();

    await user.type(screen.getByRole("textbox"), "PROD{Enter}");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes the last tag on Backspace when the draft is empty", async () => {
    const onChange = vi.fn();
    render(<TagsInput tags={["prod", "api"]} onChange={onChange} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Backspace}");

    expect(onChange).toHaveBeenCalledWith(["prod"]);
  });

  it("removes a tag via its remove button", async () => {
    const onChange = vi.fn();
    render(<TagsInput tags={["prod", "api"]} onChange={onChange} />);
    const user = userEvent.setup();

    await user.click(screen.getByLabelText("Remove tag prod"));

    expect(onChange).toHaveBeenCalledWith(["api"]);
  });

  it("hides the input once the max tag count is reached", () => {
    render(<TagsInput tags={["a", "b", "c", "d", "e"]} onChange={vi.fn()} />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
