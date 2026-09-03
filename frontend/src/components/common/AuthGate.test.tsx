import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AuthGate, useAuth } from "./AuthGate";
import { clearStoredUserToken, getStoredUserToken } from "../../lib/authToken";

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function Whoami() {
  const { user } = useAuth();
  return <div>Logged in as {user.email}</div>;
}

describe("AuthGate", () => {
  beforeEach(() => {
    clearStoredUserToken();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearStoredUserToken();
  });

  it("renders children when /api/auth/me succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ id: "u1", email: "me@example.com", created_at: new Date().toISOString() }, 200),
      ),
    );

    render(
      <AuthGate>
        <Whoami />
      </AuthGate>,
    );

    expect(await screen.findByText("Logged in as me@example.com")).toBeInTheDocument();
  });

  it("shows the login form when unauthenticated", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ error: { code: "INVALID_SESSION", message: "Missing user session token." } }, 401),
      ),
    );

    render(
      <AuthGate>
        <Whoami />
      </AuthGate>,
    );

    expect(await screen.findByText("Log In")).toBeInTheDocument();
    expect(screen.queryByText(/logged in as/i)).not.toBeInTheDocument();
  });

  it("logs in successfully and stores the token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: "INVALID_SESSION", message: "x" } }, 401),
      ) // initial probe
      .mockResolvedValueOnce(
        jsonResponse(
          { token: "abc.def.ghi", user: { id: "u1", email: "me@example.com", created_at: new Date().toISOString() } },
          200,
        ),
      ); // login submit
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthGate>
        <Whoami />
      </AuthGate>,
    );

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Email"), "me@example.com");
    await user.type(screen.getByLabelText("Password"), "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: "Log In" }));

    expect(await screen.findByText("Logged in as me@example.com")).toBeInTheDocument();
    expect(getStoredUserToken()).toBe("abc.def.ghi");
  });

  it("toggles to the signup form and back", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ error: { code: "INVALID_SESSION", message: "x" } }, 401),
      ),
    );

    render(
      <AuthGate>
        <Whoami />
      </AuthGate>,
    );

    const user = userEvent.setup();
    await user.click(await screen.findByText("Need an account? Sign up"));
    expect(screen.getByRole("button", { name: "Sign Up" })).toBeInTheDocument();

    await user.click(screen.getByText("Already have an account? Log in"));
    expect(screen.getByRole("button", { name: "Log In" })).toBeInTheDocument();
  });
});
