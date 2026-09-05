import { useState, type FormEvent } from "react";
import { Bell, Copy, Globe, Mail, MessageSquare, Plus, RefreshCw, Send, Trash2 } from "lucide-react";

import {
  useNotifications,
  useCreateNotification,
  useUpdateNotification,
  useDeleteNotification,
  useTestNotification,
} from "../hooks/useNotifications";
import { useStatusPageSlug, useRegenerateStatusPageSlug } from "../hooks/useAccount";
import { useToast } from "../components/common/Toast";
import { ApiError } from "../api/client";
import { Spinner } from "../components/common/Spinner";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { Select } from "../components/common/Select";
import type { NotificationChannelCreateInput, NotificationType } from "../types";

const TYPE_LABELS: Record<NotificationType, string> = {
  discord: "Discord",
  telegram: "Telegram",
  email: "Email",
};

const TYPE_ICONS: Record<NotificationType, typeof MessageSquare> = {
  discord: MessageSquare,
  telegram: Send,
  email: Mail,
};

export function Settings() {
  const { showToast } = useToast();
  const notificationsQuery = useNotifications();
  const createNotification = useCreateNotification();
  const deleteNotification = useDeleteNotification();
  const updateNotification = useUpdateNotification();
  const testNotification = useTestNotification();
  const statusPageQuery = useStatusPageSlug();
  const regenerateSlug = useRegenerateStatusPageSlug();
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  const [type, setType] = useState<NotificationType>("discord");
  const [name, setName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setWebhookUrl("");
    setBotToken("");
    setChatId("");
    setToEmail("");
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const payload: NotificationChannelCreateInput = {
      type,
      name: name.trim(),
      enabled: true,
      ...(type === "discord" && { webhook_url: webhookUrl.trim() }),
      ...(type === "telegram" && { bot_token: botToken.trim(), chat_id: chatId.trim() }),
      ...(type === "email" && { to_email: toEmail.trim() }),
    };

    try {
      await createNotification.mutateAsync(payload);
      showToast("success", "Notification channel added");
      resetForm();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Unable to add notification channel.");
    }
  }

  async function handleTest(id: string) {
    setTestingId(id);
    try {
      const result = await testNotification.mutateAsync(id);
      showToast(result.success ? "success" : "error", result.message);
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : "Notification test failed.");
    } finally {
      setTestingId(null);
    }
  }

  async function handleToggleEnabled(id: string, enabled: boolean) {
    try {
      await updateNotification.mutateAsync({ id, input: { enabled } });
    } catch {
      showToast("error", "Unable to update notification channel.");
    }
  }

  async function handleDelete() {
    if (!pendingDeleteId) return;
    try {
      await deleteNotification.mutateAsync(pendingDeleteId);
      showToast("success", "Notification channel removed");
    } catch {
      showToast("error", "Unable to remove notification channel.");
    } finally {
      setPendingDeleteId(null);
    }
  }

  function statusPageUrl(slug: string): string {
    return `${window.location.origin}/status/${slug}`;
  }

  async function handleCopyStatusPageLink() {
    if (!statusPageQuery.data) return;
    try {
      await navigator.clipboard.writeText(statusPageUrl(statusPageQuery.data.slug));
      showToast("success", "Link copied to clipboard");
    } catch {
      showToast("error", "Unable to copy link");
    }
  }

  async function handleRegenerate() {
    try {
      await regenerateSlug.mutateAsync();
      showToast("success", "New status page link generated -- the old link no longer works");
    } catch {
      showToast("error", "Unable to generate a new link.");
    } finally {
      setConfirmRegenerate(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="mt-1 text-sm text-muted">Configure how APIWatch notifies you about outages.</p>
      </div>

      <section className="card-base p-5">
        <h2 className="section-title mb-1">Notification Channels</h2>
        <p className="mb-4 text-sm text-muted">
          Add a channel to receive outage and recovery alerts. Credentials are encrypted at rest and
          never shown again in full once saved.
        </p>

        <form onSubmit={(e) => void handleAdd(e)} className="mb-5 flex flex-col gap-3 border-b border-edge pb-5">
          <div>
            <label className="label-base" htmlFor="channel-type">
              Channel Type
            </label>
            <Select
              id="channel-type"
              value={type}
              onChange={setType}
              options={[
                { value: "discord", label: "Discord" },
                { value: "telegram", label: "Telegram" },
                { value: "email", label: "Email" },
              ]}
              className="w-full"
            />
          </div>

          <div>
            <label className="label-base" htmlFor="channel-name">
              Channel Name
            </label>
            <input
              id="channel-name"
              type="text"
              className="input-base"
              placeholder="Production Alerts"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {type === "discord" && (
            <div>
              <label className="label-base" htmlFor="channel-webhook">
                Webhook URL
              </label>
              <input
                id="channel-webhook"
                type="password"
                className="input-base mono-value"
                placeholder="https://discord.com/api/webhooks/…"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                required
              />
            </div>
          )}

          {type === "telegram" && (
            <>
              <div>
                <label className="label-base" htmlFor="channel-bot-token">
                  Bot Token
                </label>
                <input
                  id="channel-bot-token"
                  type="password"
                  className="input-base mono-value"
                  placeholder="123456:ABC-DEF…"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  required
                />
                <p className="field-hint">
                  Create a bot with{" "}
                  <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    @BotFather
                  </a>{" "}
                  on Telegram to get a token.
                </p>
              </div>
              <div>
                <label className="label-base" htmlFor="channel-chat-id">
                  Chat ID
                </label>
                <input
                  id="channel-chat-id"
                  type="text"
                  className="input-base mono-value"
                  placeholder="123456789"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  required
                />
                <p className="field-hint">
                  Message your bot, then find your chat ID with{" "}
                  <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    @userinfobot
                  </a>
                  .
                </p>
              </div>
            </>
          )}

          {type === "email" && (
            <div>
              <label className="label-base" htmlFor="channel-email">
                Recipient Email
              </label>
              <input
                id="channel-email"
                type="email"
                className="input-base"
                placeholder="you@example.com"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                required
              />
              <p className="field-hint">
                Sent via the SMTP server configured on the backend. If delivery fails, the server may not
                have SMTP set up yet.
              </p>
            </div>
          )}

          {formError && <p className="text-sm text-danger">{formError}</p>}
          <button type="submit" className="btn-primary self-start" disabled={createNotification.isPending}>
            {createNotification.isPending ? <Spinner /> : <Plus size={16} />}
            Add Channel
          </button>
        </form>

        {notificationsQuery.isLoading && <Spinner label="Loading channels…" />}

        {notificationsQuery.isError && (
          <ErrorState
            description="Unable to load notification channels. Please check your connection and try again."
            onRetry={() => void notificationsQuery.refetch()}
          />
        )}

        {notificationsQuery.data && notificationsQuery.data.length === 0 && (
          <EmptyState icon={<Bell size={24} />} title="No notification channels yet" />
        )}

        {notificationsQuery.data && notificationsQuery.data.length > 0 && (
          <ul className="flex flex-col gap-3">
            {notificationsQuery.data.map((channel) => {
              const TypeIcon = TYPE_ICONS[channel.type];
              return (
                <li
                  key={channel.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-edge px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface2 text-muted">
                      <TypeIcon size={15} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-text">
                        {channel.name}
                        <span className="rounded bg-surface2 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                          {TYPE_LABELS[channel.type]}
                        </span>
                      </div>
                      <div className="mono-value truncate text-xs text-muted">{channel.target_masked}</div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-muted">
                      <input
                        type="checkbox"
                        checked={channel.enabled}
                        onChange={(e) => void handleToggleEnabled(channel.id, e.target.checked)}
                        className="h-4 w-4 rounded border-edge accent-[var(--aw-accent)]"
                        aria-label={`Enable ${channel.name}`}
                      />
                      Enabled
                    </label>
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={() => void handleTest(channel.id)}
                      disabled={testingId === channel.id}
                    >
                      {testingId === channel.id ? <Spinner /> : "Test"}
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => setPendingDeleteId(channel.id)}
                      aria-label={`Delete ${channel.name}`}
                      title="Delete channel"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card-base p-5">
        <h2 className="section-title mb-1">Public Status Page</h2>
        <p className="mb-4 text-sm text-muted">
          Anyone with this link can see the name and status/uptime of monitors you've marked "Show on
          public status page" -- no access key or account required. The target URL is never shown there.
          Mark a monitor public from its edit page.
        </p>

        {statusPageQuery.isLoading && <Spinner label="Loading…" />}

        {statusPageQuery.isError && (
          <ErrorState
            description="Unable to load your status page link."
            onRetry={() => void statusPageQuery.refetch()}
          />
        )}

        {statusPageQuery.data && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-edge px-3 py-2.5">
              <Globe size={15} className="shrink-0 text-muted" />
              <a
                href={`/status/${statusPageQuery.data.slug}`}
                target="_blank"
                rel="noreferrer"
                className="mono-value truncate text-sm text-accent hover:underline"
              >
                {statusPageUrl(statusPageQuery.data.slug)}
              </a>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary text-xs" onClick={() => void handleCopyStatusPageLink()}>
                <Copy size={13} />
                Copy Link
              </button>
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => setConfirmRegenerate(true)}
                disabled={regenerateSlug.isPending}
              >
                {regenerateSlug.isPending ? <Spinner /> : <RefreshCw size={13} />}
                Regenerate Link
              </button>
            </div>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Remove notification channel?"
        description="Monitors using this channel will stop sending alerts to it."
        confirmLabel="Remove"
        danger
        busy={deleteNotification.isPending}
        onConfirm={() => void handleDelete()}
        onCancel={() => setPendingDeleteId(null)}
      />

      <ConfirmDialog
        open={confirmRegenerate}
        title="Regenerate status page link?"
        description="The current link will stop working immediately. Anyone you've shared it with will need the new one."
        confirmLabel="Regenerate"
        danger
        busy={regenerateSlug.isPending}
        onConfirm={() => void handleRegenerate()}
        onCancel={() => setConfirmRegenerate(false)}
      />
    </div>
  );
}
