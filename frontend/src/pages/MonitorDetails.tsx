import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pause, Pencil, Play, Trash2, Zap } from "lucide-react";

import type { Period } from "../types";
import { useMonitor, useDeleteMonitor, usePauseMonitor, useResumeMonitor, useRunManualCheck } from "../hooks/useMonitors";
import { useChecks, useMetrics, useUptime } from "../hooks/useChecks";
import { useMonitorIncidents } from "../hooks/useIncidents";
import { StatusBadge } from "../components/common/Status";
import { MethodBadge } from "../components/common/MethodBadge";
import { Spinner } from "../components/common/Spinner";
import { ErrorState } from "../components/common/ErrorState";
import { EmptyState } from "../components/common/EmptyState";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { ResponseTimeChart } from "../components/charts/ResponseTimeChart";
import { StatusTimeline } from "../components/charts/StatusTimeline";
import { CheckHistoryTable } from "../components/monitors/CheckHistoryTable";
import { IncidentCard } from "../components/incidents/IncidentCard";
import { useToast } from "../components/common/Toast";
import { formatRelativeTime, formatResponseTimeOrStatus, formatUptime } from "../lib/format";

const PERIODS: { value: Period; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
];

export function MonitorDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [period, setPeriod] = useState<Period>("24h");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const monitorQuery = useMonitor(id);
  const checksQuery = useChecks(id, 100);
  const metricsQuery = useMetrics(id, period);
  const uptimeQuery = useUptime(id, period);
  const incidentsQuery = useMonitorIncidents(id);

  const pauseMonitor = usePauseMonitor();
  const resumeMonitor = useResumeMonitor();
  const runCheck = useRunManualCheck();
  const deleteMonitor = useDeleteMonitor();

  if (monitorQuery.isLoading) {
    return <Spinner label="Loading monitor…" />;
  }

  if (monitorQuery.isError || !monitorQuery.data) {
    return (
      <ErrorState
        title="Unable to load this monitor"
        description="It may have been deleted, or there's a connection problem."
        onRetry={() => void monitorQuery.refetch()}
      />
    );
  }

  const monitor = monitorQuery.data;

  const handlePauseResume = async () => {
    try {
      if (monitor.is_active) {
        await pauseMonitor.mutateAsync(monitor.id);
        showToast("success", "Monitor paused");
      } else {
        await resumeMonitor.mutateAsync(monitor.id);
        showToast("success", "Monitor resumed");
      }
    } catch {
      showToast("error", "Unable to update monitor");
    }
  };

  const handleRunCheck = async () => {
    try {
      await runCheck.mutateAsync(monitor.id);
      showToast("success", "Health check completed");
    } catch {
      showToast("error", "Health check failed to run");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMonitor.mutateAsync(monitor.id);
      showToast("success", `${monitor.name} deleted`);
      navigate("/");
    } catch {
      showToast("error", "Unable to delete monitor");
      setConfirmDelete(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
          <ArrowLeft size={14} />
          Monitors
        </Link>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="page-title">{monitor.name}</h1>
            <StatusBadge status={monitor.status} />
          </div>
          <div className="mono-value mt-1.5 flex items-center gap-2 text-sm text-muted">
            <MethodBadge method={monitor.method} />
            {monitor.url}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" className="btn-secondary" onClick={() => void handleRunCheck()} disabled={runCheck.isPending}>
            {runCheck.isPending ? <Spinner /> : <Zap size={16} />}
            Run Check
          </button>
          <button type="button" className="btn-secondary" onClick={() => void handlePauseResume()}>
            {monitor.is_active ? <Pause size={16} /> : <Play size={16} />}
            {monitor.is_active ? "Pause" : "Resume"}
          </button>
          <Link to={`/monitors/${monitor.id}/edit`} className="btn-secondary">
            <Pencil size={16} />
            Edit
          </Link>
          <button type="button" className="btn-danger" onClick={() => setConfirmDelete(true)} aria-label="Delete monitor" title="Delete monitor">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card-base p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">Uptime ({period})</div>
          <div className="mono-value mt-2 text-2xl font-semibold text-text">
            {formatUptime(uptimeQuery.data?.uptime_percentage ?? null)}
          </div>
        </div>
        <div className="card-base p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">Response Time</div>
          <div className="mono-value mt-2 text-2xl font-semibold text-text">
            {formatResponseTimeOrStatus(monitor.http_status, monitor.response_time_ms)}
          </div>
        </div>
        <div className="card-base p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">Last Check</div>
          <div className="mono-value mt-2 text-2xl font-semibold text-text">
            {formatRelativeTime(monitor.last_checked_at)}
          </div>
        </div>
      </div>

      <section className="card-base p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="section-title">Response Time</h2>
          <div className="flex gap-1 rounded-lg border border-edge p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  period === p.value ? "bg-accent-dim text-accent" : "text-muted hover:text-text"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {metricsQuery.isLoading ? <Spinner label="Loading chart…" /> : <ResponseTimeChart points={metricsQuery.data ?? []} />}
      </section>

      <section className="card-base p-5">
        <h2 className="section-title mb-4">Status Timeline</h2>
        {checksQuery.isLoading ? (
          <Spinner label="Loading timeline…" />
        ) : (
          <StatusTimeline checks={checksQuery.data ?? []} periodLabel="Most recent checks" />
        )}
      </section>

      <section className="card-base p-5">
        <h2 className="section-title mb-4">Recent Checks</h2>
        {checksQuery.isLoading ? <Spinner label="Loading checks…" /> : <CheckHistoryTable checks={(checksQuery.data ?? []).slice(0, 20)} />}
      </section>

      <section>
        <h2 className="section-title mb-3">Incidents</h2>
        {incidentsQuery.isLoading && <Spinner label="Loading incidents…" />}
        {incidentsQuery.data && incidentsQuery.data.length === 0 && (
          <EmptyState title="No incidents" description="Everything looks healthy." />
        )}
        {incidentsQuery.data && incidentsQuery.data.length > 0 && (
          <div className="flex flex-col gap-3">
            {incidentsQuery.data.map((incident) => (
              <IncidentCard key={incident.id} incident={incident} />
            ))}
          </div>
        )}
      </section>

      <section className="card-base p-5">
        <h2 className="section-title mb-4">Configuration</h2>
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">Interval</dt>
            <dd className="mono-value text-text">{monitor.interval_seconds}s</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Timeout</dt>
            <dd className="mono-value text-text">{monitor.timeout_seconds}s</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Expected Status Codes</dt>
            <dd className="mono-value text-text">{monitor.expected_status_codes.join(", ")}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Headers</dt>
            <dd className="mono-value text-text">
              {Object.keys(monitor.headers).length > 0 ? `${Object.keys(monitor.headers).length} configured` : "None"}
            </dd>
          </div>
        </dl>
      </section>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${monitor.name}?`}
        description="This permanently removes the monitor along with its check history and incidents. This cannot be undone."
        confirmLabel="Delete monitor"
        danger
        busy={deleteMonitor.isPending}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
