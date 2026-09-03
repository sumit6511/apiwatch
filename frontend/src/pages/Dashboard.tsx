import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Activity, Plus, SearchX } from "lucide-react";

import { useMonitors } from "../hooks/useMonitors";
import { useDashboardSummary } from "../hooks/useDashboardSummary";
import { MetricCard } from "../components/dashboard/MetricCard";
import { MonitorCard } from "../components/monitors/MonitorCard";
import { MetricCardSkeleton, MonitorCardSkeleton } from "../components/common/Skeleton";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { formatUptime } from "../lib/format";

export function Dashboard() {
  const [searchParams] = useSearchParams();
  const query = (searchParams.get("q") ?? "").trim().toLowerCase();

  const monitorsQuery = useMonitors();
  const summaryQuery = useDashboardSummary();

  const filteredMonitors = useMemo(() => {
    const monitors = monitorsQuery.data ?? [];
    if (!query) return monitors;
    return monitors.filter(
      (m) => m.name.toLowerCase().includes(query) || m.url.toLowerCase().includes(query),
    );
  }, [monitorsQuery.data, query]);

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
            <MetricCard label="Monitors" value={summaryQuery.data.total_monitors} />
            <MetricCard label="Operational" value={summaryQuery.data.operational} valueClassName="status-up" />
            <MetricCard label="Down" value={summaryQuery.data.down} valueClassName="status-down" />
            <MetricCard label="Paused" value={summaryQuery.data.paused} valueClassName="status-paused" />
            <MetricCard label="Overall Uptime" value={formatUptime(summaryQuery.data.overall_uptime_percentage)} />
          </>
        ) : summaryQuery.isError ? (
          <div className="col-span-2 sm:col-span-3 lg:col-span-5">
            <ErrorState description="Unable to load summary metrics." onRetry={() => void summaryQuery.refetch()} />
          </div>
        ) : null}
      </div>

      <div>
        <h2 className="section-title mb-3">Monitors</h2>

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

        {filteredMonitors.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMonitors.map((monitor) => (
              <MonitorCard key={monitor.id} monitor={monitor} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
