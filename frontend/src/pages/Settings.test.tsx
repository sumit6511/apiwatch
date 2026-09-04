import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "../test-utils";
import { Settings } from "./Settings";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Settings", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the Discord webhook field by default", async () => {
    renderWithProviders(<Settings />);
    expect(await screen.findByLabelText("Webhook URL")).toBeInTheDocument();
    expect(screen.queryByLabelText("Bot Token")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Recipient Email")).not.toBeInTheDocument();
  });

  it("switches to Telegram fields (bot token + chat id) and hides Discord's", async () => {
    renderWithProviders(<Settings />);
    const user = userEvent.setup();

    await user.selectOptions(await screen.findByLabelText("Channel Type"), "telegram");

    expect(screen.getByLabelText("Bot Token")).toBeInTheDocument();
    expect(screen.getByLabelText("Chat ID")).toBeInTheDocument();
    expect(screen.queryByLabelText("Webhook URL")).not.toBeInTheDocument();
  });

  it("switches to the Email field and hides the others", async () => {
    renderWithProviders(<Settings />);
    const user = userEvent.setup();

    await user.selectOptions(await screen.findByLabelText("Channel Type"), "email");

    expect(screen.getByLabelText("Recipient Email")).toBeInTheDocument();
    expect(screen.queryByLabelText("Webhook URL")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Bot Token")).not.toBeInTheDocument();
  });

  it("submits a Telegram channel with the right payload shape", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([])) // initial list
      .mockResolvedValueOnce(
        jsonResponse(
          { id: "c1", type: "telegram", name: "Ops", target_masked: "Telegram chat •••6789", enabled: true, created_at: new Date().toISOString() },
          201,
        ),
      ) // create response
      .mockResolvedValue(jsonResponse([])); // invalidated list refetch (and anything after)
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders(<Settings />);
    const user = userEvent.setup();

    await user.selectOptions(await screen.findByLabelText("Channel Type"), "telegram");
    await user.type(screen.getByLabelText("Channel Name"), "Ops");
    await user.type(screen.getByLabelText("Bot Token"), "123456:ABC-DEF");
    await user.type(screen.getByLabelText("Chat ID"), "123456789");
    await user.click(screen.getByRole("button", { name: "Add Channel" }));

    await screen.findByText("Notification channel added");

    const createCall = fetchMock.mock.calls.find(
      (call) => String(call[0]).endsWith("/api/notifications") && (call[1] as RequestInit)?.method === "POST",
    );
    expect(createCall).toBeDefined();
    const body = JSON.parse((createCall![1] as RequestInit).body as string);
    expect(body).toMatchObject({
      type: "telegram",
      name: "Ops",
      bot_token: "123456:ABC-DEF",
      chat_id: "123456789",
    });
    expect(body.webhook_url).toBeUndefined();
  });

  it("renders the channel type badge and masked target for existing channels", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse([
          {
            id: "c1",
            type: "email",
            name: "My Email",
            target_masked: "j••••@example.com",
            enabled: true,
            created_at: new Date().toISOString(),
          },
        ]),
      ),
    );

    renderWithProviders(<Settings />);

    const row = (await screen.findByText("My Email")).closest("li")!;
    // "Email" in the DOM -- the badge's all-caps look comes from CSS
    // `uppercase`, which doesn't change the actual text content.
    expect(within(row).getByText("Email")).toBeInTheDocument();
    expect(within(row).getByText("j••••@example.com")).toBeInTheDocument();
  });
});
