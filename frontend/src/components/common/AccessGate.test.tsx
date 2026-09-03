import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AccessGate } from "./AccessGate";
import { clearStoredAccessKey, getStoredAccessKey } from "../../lib/accessKey";

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AccessGate", () => {
  beforeEach(() => {
    clearStoredAccessKey();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearStoredAccessKey();
  });

  it("renders children immediately when the backend has no key configured", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([], 200)));

    render(
      <AccessGate>
        <div>Protected content</div>
      </AccessGate>,
    );

    expect(await screen.findByText("Protected content")).toBeInTheDocument();
  });

  it("shows the lock screen when the backend rejects with 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ error: { code: "UNAUTHORIZED", message: "Missing or invalid access key." } }, 401),
      ),
    );

    render(
      <AccessGate>
        <div>Protected content</div>
      </AccessGate>,
    );

    expect(await screen.findByText(/this deployment is protected/i)).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("unlocks and stores the key after a successful submission", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { code: "UNAUTHORIZED", message: "x" } }, 401)) // initial probe
      .mockResolvedValueOnce(jsonResponse([], 200)); // after submitting the correct key
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AccessGate>
        <div>Protected content</div>
      </AccessGate>,
    );

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Access Key"), "correct-key");
    await user.click(screen.getByRole("button", { name: "Unlock" }));

    expect(await screen.findByText("Protected content")).toBeInTheDocument();
    expect(getStoredAccessKey()).toBe("correct-key");
  });

  it("shows an error and stays locked when the submitted key is wrong", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { code: "UNAUTHORIZED", message: "x" } }, 401))
      .mockResolvedValueOnce(jsonResponse({ error: { code: "UNAUTHORIZED", message: "x" } }, 401));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AccessGate>
        <div>Protected content</div>
      </AccessGate>,
    );

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Access Key"), "wrong-key");
    await user.click(screen.getByRole("button", { name: "Unlock" }));

    expect(await screen.findByText("Incorrect access key.")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });
});
