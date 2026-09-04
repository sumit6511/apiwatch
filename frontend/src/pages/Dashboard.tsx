import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Activity, AlertCircle, Gauge, LayoutGrid, PauseCircle, Plus, Rows3, SearchX, SquareCheck } from "lucide-react";

import { useMonitors } from "../hooks/useMonitors";
import { useDashboardSummary } from "../hooks/useDashboardSummary";
import { MetricCard } from "../components/dashboard/MetricCard";
import { MonitorCard } from "../components/monitors/MonitorCard";
import { MonitorRow } from "../components/monitors/MonitorRow";
import { MetricCardSkeleton, MonitorCardSkeleton } from "../components/common/Skeleton";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { formatUptime } from "../lib/format";
import { sortMonitors, type MonitorSortKey } from "../lib/monitorSort";
import { getStoredMonitorView, setStoredMonitorView, type MonitorView } from "../lib/monitorView";

const SORT_OPTIONS: { value: MonitorSortKey; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "name", label: "Name (A-Z)" },
  { value: "status", label: "Status" },
  { value: "uptime", label: "Uptime (lowest first)" },
];

export function Dashboard() {
  const [searchParams] = useSearchParams();
  const query = (searchParams.get("q") ?? "").trim().toLowerCase();
  const [sortKey, setSortKey] = useState<MonitorSortKey>("newest");
  const [view, setView] = useState<MonitorView>(getStoredMonitorView);

  const monitorsQuery = useMonitors();
  const summaryQuery = useDashboardSummary();

  const filteredMonitors = useMemo(() => {
    const monitors = monitorsQuery.data ?? [];
    if (!query) return monitors;
    return monitors.filter(
      (m) => m.name.toLowerCase().includes(query) || m.url.toLowerCase().includes(query),
    );
  }, [monitorsQuery.data, query]);

  const sortedMonitors = useMemo(() => sortMonitors(filteredMonitors, sortKey), [filteredMonitors, sortKey]);

  function handleViewChange(next: MonitorView) {
    setView(next);
    setStoredMonitorView(next);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="mt-1 text-sm text-muted">Monitor the health and performance of your services.</p>
        </div>
        <Link to="/monitors/new" className="btn-primary self-start sm:self-auto">
          <Plus size={16} />
          Add Monitor
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {summaryQuery.isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <MetricCardSkeleton key={i} />)
        ) : summaryQuery.data ? (
          <>
            <MetricCard label="Monitors" value={summaryQuery.data.total_monitors} icon={<Activity size={16} />} />
            <MetricCard
              label="Operational"
              value={summaryQuery.data.operational}
              valueClassName="status-up"
              icon={<SquareCheck size={16} />}
            />
            <MetricCard
              label="Down"
              value={summaryQuery.data.down}
              valueClassName="status-down"
              icon={<AlertCircle size={16} />}
            />
            <MetricCard
              label="Paused"
              value={summaryQuery.data.paused}
              valueClassName="status-paused"
              icon={<PauseCircle size={16} />}
            />
            <MetricCard
              label="Overall Uptime"
              value={formatUptime(summaryQuery.data.overall_uptime_percentage)}
              icon={<Gauge size={16} />}
            />
          </>
        ) : summaryQuery.isError ? (
          <div className="col-span-2 sm:col-span-3 lg:col-span-5">
            <ErrorState description="Unable to load summary metrics." onRetry={() => void summaryQuery.refetch()} />
          </div>
        ) : null}
      </div>

      <div>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="section-title">Monitors</h2>
          {monitorsQuery.data && monitorsQuery.data.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as MonitorSortKey)}
                className="input-base w-auto py-1.5 text-xs"
                aria-label="Sort monitors"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="flex gap-0.5 rounded-lg border border-edge p-0.5">
                <button
                  type="button"
                  onClick={() => handleViewChange("grid")}
                  aria-label="Grid view"
                  aria-pressed={view === "grid"}
                  className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
                    view === "grid" ? "bg-accent-dim text-accent" : "text-muted hover:text-text"
                  }`}
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleViewChange("list")}
                  aria-label="List view"
                  aria-pressed={view === "list"}
                  className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
                    view === "list" ? "bg-accent-dim text-accent" : "text-muted hover:text-text"
                  }`}
                >
                  <Rows3 size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {monitorsQuery.isLoading && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <MonitorCardSkeleton key={i} />
            ))}
          </div>
        )}

        {monitorsQuery.isError && (
          <ErrorState
            description="Please check your connection and try again."
            onRetry={() => void monitorsQuery.refetch()}
          />
        )}

        {monitorsQuery.data && monitorsQuery.data.length === 0 && (
          <EmptyState
            icon={<Activity size={28} />}
            title="No monitors yet"
            description="Add your first endpoint and APIWatch will begin monitoring it."
            action={
              <Link to="/monitors/new" className="btn-primary">
                <Plus size={16} />
                Add Monitor
              </Link>
            }
          />
        )}

        {monitorsQuery.data && monitorsQuery.data.length > 0 && filteredMonitors.length === 0 && (
          <EmptyState icon={<SearchX size={28} />} title="No monitors match your search" />
        )}

        {sortedMonitors.length > 0 &&
          (view === "grid" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sortedMonitors.map((monitor) => (
                <MonitorCard key={monitor.id} monitor={monitor} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {sortedMonitors.map((monitor) => (
                <MonitorRow key={monitor.id} monitor={monitor} />
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}
