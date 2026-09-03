import { useState } from "react";
import { Bell, Plus, Trash2 } from "lucide-react";

import {
  useNotifications,
  useCreateNotification,
  useUpdateNotification,
  useDeleteNotification,
  useTestNotification,
} from "../hooks/useNotifications";
import { useToast } from "../components/common/Toast";
import { ApiError } from "../api/client";
import { Spinner } from "../components/common/Spinner";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { ConfirmDialog } from "../components/common/ConfirmDialog";

export function Settings() {
  const { showToast } = useToast();
  const notificationsQuery = useNotifications();
  const createNotification = useCreateNotification();
  const deleteNotification = useDeleteNotification();
  const updateNotification = useUpdateNotification();
  const testNotification = useTestNotification();

  const [name, setName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    try {
      await createNotification.mutateAsync({ type: "discord", name: name.trim(), webhook_url: webhookUrl.trim(), enabled: true });
      showToast("success", "Notification channel added");
      setName("");
      setWebhookUrl("");
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

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="mt-1 text-sm text-muted">Configure how APIWatch notifies you about outages.</p>
      </div>

      <section className="card-base p-5">
        <h2 className="section-title mb-1">Discord Notifications</h2>
        <p className="mb-4 text-sm text-muted">
          Add a Discord webhook to receive outage and recovery alerts. The URL is encrypted at rest and
          never shown again in full once saved.
        </p>

        <form onSubmit={(e) => void handleAdd(e)} className="mb-5 flex flex-col gap-3 border-b border-edge pb-5">
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
            {notificationsQuery.data.map((channel) => (
              <li key={channel.id} className="flex items-center justify-between gap-3 rounded-lg border border-edge px-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text">{channel.name}</div>
                  <div className="mono-value truncate text-xs text-muted">{channel.webhook_url_masked}</div>
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
            ))}
          </ul>
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
    </div>
  );
}
