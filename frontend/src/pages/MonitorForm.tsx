import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import type { HttpMethod } from "../types";
import { useMonitor, useCreateMonitor, useUpdateMonitor, useTestRequest } from "../hooks/useMonitors";
import { useNotifications } from "../hooks/useNotifications";
import { useToast } from "../components/common/Toast";
import { ApiError } from "../api/client";
import {
  HeadersEditor,
  headersToRows,
  rowsToHeaders,
  type HeaderRow,
} from "../components/monitors/HeadersEditor";
import { TestRequestPanel } from "../components/monitors/TestRequestPanel";
import { Spinner } from "../components/common/Spinner";
import { ErrorState } from "../components/common/ErrorState";
import type { ManualCheckResult } from "../types";

const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
type IntervalUnit = "seconds" | "minutes" | "hours";

function secondsToIntervalInput(totalSeconds: number): { value: number; unit: IntervalUnit } {
  if (totalSeconds >= 3600 && totalSeconds % 3600 === 0) return { value: totalSeconds / 3600, unit: "hours" };
  if (totalSeconds >= 60 && totalSeconds % 60 === 0) return { value: totalSeconds / 60, unit: "minutes" };
  return { value: totalSeconds, unit: "seconds" };
}

function intervalInputToSeconds(value: number, unit: IntervalUnit): number {
  const multiplier = unit === "hours" ? 3600 : unit === "minutes" ? 60 : 1;
  return Math.round(value * multiplier);
}

export function MonitorForm({ mode }: { mode: "create" | "edit" }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const existing = useMonitor(mode === "edit" ? id : undefined);
  const notificationsQuery = useNotifications();
  const createMonitor = useCreateMonitor();
  const updateMonitor = useUpdateMonitor(id ?? "");
  const testRequest = useTestRequest();

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [headerRows, setHeaderRows] = useState<HeaderRow[]>([]);
  const [bodyText, setBodyText] = useState("");
  const [intervalValue, setIntervalValue] = useState(5);
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>("minutes");
  const [timeoutSeconds, setTimeoutSeconds] = useState(10);
  const [statusCodesText, setStatusCodesText] = useState("200");
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const [testResult, setTestResult] = useState<ManualCheckResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "edit" || !existing.data) return;
    const monitor = existing.data;
    setName(monitor.name);
    setUrl(monitor.url);
    setMethod(monitor.method);
    setHeaderRows(headersToRows(monitor.headers));
    setBodyText(
      monitor.body === null ? "" : typeof monitor.body === "string" ? monitor.body : JSON.stringify(monitor.body, null, 2),
    );
    const interval = secondsToIntervalInput(monitor.interval_seconds);
    setIntervalValue(interval.value);
    setIntervalUnit(interval.unit);
    setTimeoutSeconds(monitor.timeout_seconds);
    setStatusCodesText(monitor.expected_status_codes.join(", "));
    setSelectedChannels(monitor.notification_channel_ids);
  }, [mode, existing.data]);

  function parseBody(): Record<string, unknown> | string | null {
    const trimmed = bodyText.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      return trimmed;
    }
  }

  function parseStatusCodes(): number[] {
    return statusCodesText
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      // Number("") is 0, not NaN -- filter blanks out *before* converting,
      // or a cleared field silently becomes [0] instead of [].
      .map((part) => Number(part))
      .filter((n) => Number.isFinite(n));
  }

  function buildPayload() {
    return {
      name: name.trim(),
      url: url.trim(),
      method,
      headers: rowsToHeaders(headerRows),
      body: parseBody(),
      interval_seconds: intervalInputToSeconds(intervalValue, intervalUnit),
      timeout_seconds: timeoutSeconds,
      expected_status_codes: parseStatusCodes(),
      notification_channel_ids: selectedChannels,
    };
  }

  function validate(): string | null {
    if (!name.trim()) return "Monitor name is required.";
    if (!/^https?:\/\/.+/i.test(url.trim())) return "URL must start with http:// or https://.";
    const codes = parseStatusCodes();
    if (codes.length === 0) return "At least one expected status code is required.";
    const seconds = intervalInputToSeconds(intervalValue, intervalUnit);
    if (seconds < 30 || seconds > 86400) return "Interval must be between 30 seconds and 24 hours.";
    if (timeoutSeconds < 1 || timeoutSeconds > 60) return "Timeout must be between 1 and 60 seconds.";
    return null;
  }

  async function handleTestRequest() {
    setTestError(null);
    setTestResult(null);
    const trimmedUrl = url.trim();
    if (!/^https?:\/\/.+/i.test(trimmedUrl)) {
      setTestError("Enter a valid http:// or https:// URL before testing.");
      return;
    }
    try {
      const result = await testRequest.mutateAsync({
        url: trimmedUrl,
        method,
        headers: rowsToHeaders(headerRows),
        body: parseBody(),
        timeout_seconds: timeoutSeconds,
        expected_status_codes: parseStatusCodes().length ? parseStatusCodes() : [200],
      });
      setTestResult(result);
    } catch (err) {
      setTestError(err instanceof ApiError ? err.message : "Unable to run the test request.");
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    try {
      const payload = buildPayload();
      if (mode === "create") {
        const created = await createMonitor.mutateAsync(payload);
        showToast("success", "Monitor created successfully");
        navigate(`/monitors/${created.id}`);
      } else if (id) {
        await updateMonitor.mutateAsync(payload);
        showToast("success", "Monitor updated");
        navigate(`/monitors/${id}`);
      }
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Unable to save monitor.");
    }
  }

  if (mode === "edit" && existing.isLoading) {
    return <Spinner label="Loading monitor…" />;
  }

  if (mode === "edit" && existing.isError) {
    return (
      <ErrorState
        title="Unable to load this monitor"
        description="It may have been deleted, or there's a connection problem."
        onRetry={() => void existing.refetch()}
      />
    );
  }

  const saving = createMonitor.isPending || updateMonitor.isPending;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <Link
          to={mode === "edit" && id ? `/monitors/${id}` : "/"}
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"
        >
          <ArrowLeft size={14} />
          Back
        </Link>
        <h1 className="page-title mt-2">{mode === "create" ? "Add Monitor" : "Edit Monitor"}</h1>
        <p className="mt-1 text-sm text-muted">
          {mode === "create"
            ? "APIWatch will run an immediate health check as soon as this monitor is created."
            : "Changes take effect on the next scheduled check."}
        </p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-6">
        <section className="card-base flex flex-col gap-4 p-5">
          <h2 className="section-title">Basic Information</h2>
          <div>
            <label className="label-base" htmlFor="monitor-name">
              Monitor Name
            </label>
            <input
              id="monitor-name"
              type="text"
              className="input-base"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="GitHub API"
              required
            />
          </div>
          <div>
            <label className="label-base" htmlFor="monitor-url">
              URL
            </label>
            <input
              id="monitor-url"
              type="text"
              className="input-base mono-value"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.github.com"
              required
            />
            <p className="field-hint">
              Only public http:// and https:// URLs are allowed. Private, loopback, and internal
              addresses are rejected.
            </p>
          </div>
        </section>

        <section className="card-base flex flex-col gap-4 p-5">
          <h2 className="section-title">Request</h2>
          <div>
            <label className="label-base" htmlFor="monitor-method">
              HTTP Method
            </label>
            <select
              id="monitor-method"
              className="input-base"
              value={method}
              onChange={(e) => setMethod(e.target.value as HttpMethod)}
            >
              {HTTP_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="label-base">Headers</span>
            <HeadersEditor rows={headerRows} onChange={setHeaderRows} />
          </div>
          <div>
            <label className="label-base" htmlFor="monitor-body">
              Request Body
            </label>
            <textarea
              id="monitor-body"
              className="input-base mono-value min-h-24 resize-y"
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder='{"ping": "hello"}'
            />
            <p className="field-hint">Optional. JSON is parsed automatically; anything else is sent as-is.</p>
          </div>
        </section>

        <section className="card-base flex flex-col gap-4 p-5">
          <h2 className="section-title">Monitoring</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label-base" htmlFor="monitor-interval">
                Check Interval
              </label>
              <div className="flex gap-2">
                <input
                  id="monitor-interval"
                  type="number"
                  min={1}
                  className="input-base"
                  value={intervalValue}
                  onChange={(e) => setIntervalValue(Number(e.target.value))}
                />
                <select
                  className="input-base w-32"
                  value={intervalUnit}
                  onChange={(e) => setIntervalUnit(e.target.value as IntervalUnit)}
                  aria-label="Interval unit"
                >
                  <option value="seconds">seconds</option>
                  <option value="minutes">minutes</option>
                  <option value="hours">hours</option>
                </select>
              </div>
              <p className="field-hint">Between 30 seconds and 24 hours.</p>
            </div>
            <div>
              <label className="label-base" htmlFor="monitor-timeout">
                Timeout (seconds)
              </label>
              <input
                id="monitor-timeout"
                type="number"
                min={1}
                max={60}
                className="input-base"
                value={timeoutSeconds}
                onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
              />
              <p className="field-hint">Between 1 and 60 seconds.</p>
            </div>
          </div>
          <div>
            <label className="label-base" htmlFor="monitor-status-codes">
              Expected Status Codes
            </label>
            <input
              id="monitor-status-codes"
              type="text"
              className="input-base mono-value"
              value={statusCodesText}
              onChange={(e) => setStatusCodesText(e.target.value)}
              placeholder="200, 201, 204"
            />
            <p className="field-hint">Comma-separated. Any status outside this list is treated as DOWN.</p>
          </div>
        </section>

        <section className="card-base flex flex-col gap-3 p-5">
          <h2 className="section-title">Notifications</h2>
          {notificationsQuery.data && notificationsQuery.data.length > 0 ? (
            <div className="flex flex-col gap-2">
              {notificationsQuery.data.map((channel) => (
                <label key={channel.id} className="flex items-center gap-2.5 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={selectedChannels.includes(channel.id)}
                    onChange={(e) =>
                      setSelectedChannels((current) =>
                        e.target.checked
                          ? [...current, channel.id]
                          : current.filter((cid) => cid !== channel.id),
                      )
                    }
                    className="h-4 w-4 rounded border-edge accent-[var(--aw-accent)]"
                  />
                  {channel.name}
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">
              No notification channels configured yet.{" "}
              <Link to="/settings" className="text-accent hover:underline">
                Add one in Settings
              </Link>
              .
            </p>
          )}
        </section>

        <TestRequestPanel
          onTest={() => void handleTestRequest()}
          pending={testRequest.isPending}
          result={testResult}
          error={testError}
        />

        {formError && (
          <div className="rounded-lg border border-danger/30 bg-danger-dim px-4 py-3 text-sm text-danger">
            {formError}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Link to={mode === "edit" && id ? `/monitors/${id}` : "/"} className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <Spinner /> : mode === "create" ? "Create Monitor" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
