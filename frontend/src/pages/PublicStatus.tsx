import { useParams } from "react-router-dom";
import { Activity } from "lucide-react";

import { usePublicStatusPage } from "../hooks/useStatusPage";
import { ApiError } from "../api/client";
import { Spinner } from "../components/common/Spinner";
import { ErrorState } from "../components/common/ErrorState";
import { StatusBadge } from "../components/common/Status";
import { Sparkline } from "../components/charts/Sparkline";
import { formatFullDateTime, formatRelativeTime, formatUptime } from "../lib/format";
import type { MonitorStatus, PublicMonitorStatus } from "../types";

const OVERALL_COPY: Record<MonitorStatus, { label: string; className: string }> = {
  UP: { label: "All Systems Operational", className: "bg-success-dim status-up" },
  DOWN: { label: "Some Systems Are Down", className: "bg-danger-dim status-down" },
  UNKNOWN: { label: "Status Pending", className: "bg-warning-dim status-unknown" },
  PAUSED: { label: "Status Pending", className: "bg-warning-dim status-unknown" },
};

function MonitorRow({ monitor }: { monitor: PublicMonitorStatus }) {
  return (
    <div className="card-base p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-text">{monitor.name}</span>
        <StatusBadge status={monitor.status} />
      </div>
      <div className="mt-3">
        <Sparkline points={monitor.recent_checks.map((c) => ({ value: c.response_time_ms, status: c.status }))} />
      </div>
      <div className="mono-value mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <span>24h: {formatUptime(monitor.uptime_24h)}</span>
        <span>7d: {formatUptime(monitor.uptime_7d)}</span>
        <span>30d: {formatUptime(monitor.uptime_30d)}</span>
        <span className="ml-auto">Checked {formatRelativeTime(monitor.last_checked_at)}</span>
      </div>
    </div>
  );
}

export function PublicStatus() {
  const { slug } = useParams<{ slug: string }>();
  const query = usePublicStatusPage(slug ?? "");

  return (
    <div className="min-h-screen bg-bg px-4 py-10 text-text">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent-dim text-accent">
            <Activity size={17} />
          </span>
          <span className="text-base font-semibold tracking-tight">APIWatch Status</span>
        </div>

        {query.isLoading && (
          <div className="flex justify-center py-16">
            <Spinner label="Loading status…" />
          </div>
        )}

        {query.isError && (
          <ErrorState
            title={
              query.error instanceof ApiError && query.error.code === "STATUS_PAGE_NOT_FOUND"
                ? "Status page not found"
                : "Unable to load this status page"
            }
            description={
              query.error instanceof ApiError && query.error.code === "STATUS_PAGE_NOT_FOUND"
                ? "This link may have been regenerated or never existed."
                : "Please check your connection and try again."
            }
            onRetry={() => void query.refetch()}
          />
        )}

        {query.data && (
          <>
            <div className={`rounded-lg px-4 py-3 text-sm font-medium ${OVERALL_COPY[query.data.overall_status].className}`}>
              {OVERALL_COPY[query.data.overall_status].label}
            </div>

            {query.data.monitors.length === 0 ? (
              <div className="card-base p-6 text-center text-sm text-muted">
                Nothing is being shown here yet.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {query.data.monitors.map((monitor, index) => (
                  <MonitorRow key={`${monitor.name}-${index}`} monitor={monitor} />
                ))}
              </div>
            )}

            <p className="text-center text-xs text-muted">
              Last updated {formatFullDateTime(query.data.generated_at)} · Powered by APIWatch
            </p>
          </>
        )}
      </div>
    </div>
  );
}
