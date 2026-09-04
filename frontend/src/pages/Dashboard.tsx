import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  CheckSquare,
  Gauge,
  LayoutGrid,
  Pause,
  PauseCircle,
  Play,
  Plus,
  Rows3,
  SearchX,
  SquareCheck,
  Trash2,
} from "lucide-react";

import { useDeleteMonitor, useMonitors, usePauseMonitor, useResumeMonitor } from "../hooks/useMonitors";
import { useDashboardSummary } from "../hooks/useDashboardSummary";
import { MetricCard } from "../components/dashboard/MetricCard";
import { MonitorCard } from "../components/monitors/MonitorCard";
import { MonitorRow } from "../components/monitors/MonitorRow";
import { MetricCardSkeleton, MonitorCardSkeleton } from "../components/common/Skeleton";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { useToast } from "../components/common/Toast";
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
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirmDelete, setBulkConfirmDelete] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const { showToast } = useToast();
  const monitorsQuery = useMonitors();
  const summaryQuery = useDashboardSummary();
  const pauseMonitor = usePauseMonitor();
  const resumeMonitor = useResumeMonitor();
  const deleteMonitor = useDeleteMonitor();

  const tagOptions = useMemo(() => {
    const tags = new Set<string>();
    for (const monitor of monitorsQuery.data ?? []) {
      for (const tag of monitor.tags) tags.add(tag);
    }
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [monitorsQuery.data]);

  const filteredMonitors = useMemo(() => {
    const monitors = monitorsQuery.data ?? [];
    return monitors.filter((m) => {
      if (tagFilter !== "all" && !m.tags.includes(tagFilter)) return false;
      if (!query) return true;
      return m.name.toLowerCase().includes(query) || m.url.toLowerCase().includes(query);
    });
  }, [monitorsQuery.data, query, tagFilter]);

  const sortedMonitors = useMemo(() => sortMonitors(filteredMonitors, sortKey), [filteredMonitors, sortKey]);

  function handleViewChange(next: MonitorView) {
    setView(next);
    setStoredMonitorView(next);
  }

  function toggleSelectMode() {
    // Bulk-select only exists in list view (see MonitorRow) -- switch there
    // automatically rather than leaving someone stuck in grid view with a
    // "Select" button that visibly does nothing.
    if (!selectMode) handleViewChange("list");
    setSelectMode((current) => !current);
    setSelectedIds(new Set());
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedMonitors = sortedMonitors.filter((m) => selectedIds.has(m.id));

  function pluralize(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? "" : "s"}`;
  }

  async function handleBulkPause() {
    const targets = selectedMonitors.filter((m) => m.is_active);
    if (targets.length === 0) return;
    setBulkBusy(true);
    const results = await Promise.allSettled(targets.map((m) => pauseMonitor.mutateAsync(m.id)));
    const failed = results.filter((r) => r.status === "rejected").length;
    showToast(
      failed === 0 ? "success" : "error",
      failed === 0 ? `${pluralize(targets.length, "monitor")} paused` : `Paused ${targets.length - failed}, ${failed} failed`,
    );
    setBulkBusy(false);
    setSelectedIds(new Set());
  }

  async function handleBulkResume() {
    const targets = selectedMonitors.filter((m) => !m.is_active);
    if (targets.length === 0) return;
    setBulkBusy(true);
    const results = await Promise.allSettled(targets.map((m) => resumeMonitor.mutateAsync(m.id)));
    const failed = results.filter((r) => r.status === "rejected").length;
    showToast(
      failed === 0 ? "success" : "error",
      failed === 0
        ? `${pluralize(targets.length, "monitor")} resumed`
        : `Resumed ${targets.length - failed}, ${failed} failed`,
    );
    setBulkBusy(false);
    setSelectedIds(new Set());
  }

  async function handleBulkDelete() {
    setBulkBusy(true);
    const results = await Promise.allSettled(selectedMonitors.map((m) => deleteMonitor.mutateAsync(m.id)));
    const failed = results.filter((r) => r.status === "rejected").length;
    showToast(
      failed === 0 ? "success" : "error",
      failed === 0
        ? `${pluralize(selectedMonitors.length, "monitor")} deleted`
        : `Deleted ${selectedMonitors.length - failed}, ${failed} failed`,
    );
    setBulkBusy(false);
    setBulkConfirmDelete(false);
    setSelectedIds(new Set());
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
            <div className="flex flex-wrap items-center gap-2">
              {tagOptions.length > 0 && (
                <select
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  className="input-base w-auto py-1.5 text-xs"
                  aria-label="Filter by tag"
                >
                  <option value="all">All tags</option>
                  {tagOptions.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              )}
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
              <button
                type="button"
                onClick={toggleSelectMode}
                aria-label="Select monitors"
                aria-pressed={selectMode}
                className={`flex h-7 items-center gap-1.5 rounded-lg border border-edge px-2 text-xs font-medium transition ${
                  selectMode ? "bg-accent-dim text-accent" : "text-muted hover:text-text"
                }`}
              >
                <CheckSquare size={14} />
                Select
              </button>
            </div>
          )}
        </div>

        {selectMode && selectedIds.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent-dim px-4 py-2.5">
            <span className="text-sm font-medium text-text">{selectedIds.size} selected</span>
            <div className="ml-auto flex flex-wrap gap-2">
              <button type="button" className="btn-secondary text-xs" onClick={() => void handleBulkPause()} disabled={bulkBusy}>
                <Pause size={14} />
                Pause
              </button>
              <button type="button" className="btn-secondary text-xs" onClick={() => void handleBulkResume()} disabled={bulkBusy}>
                <Play size={14} />
                Resume
              </button>
              <button
                type="button"
                className="btn-danger text-xs"
                onClick={() => setBulkConfirmDelete(true)}
                disabled={bulkBusy}
              >
                <Trash2 size={14} />
                Delete
              </button>
              <button type="button" className="btn-ghost text-xs" onClick={() => setSelectedIds(new Set())}>
                Clear
              </button>
            </div>
          </div>
        )}

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
          <EmptyState icon={<SearchX size={28} />} title="No monitors match your search or filter" />
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
                <MonitorRow
                  key={monitor.id}
                  monitor={monitor}
                  selectable={selectMode}
                  selected={selectedIds.has(monitor.id)}
                  onToggleSelect={toggleSelect}
                />
              ))}
            </div>
          ))}
      </div>

      <ConfirmDialog
        open={bulkConfirmDelete}
        title={`Delete ${selectedIds.size} monitor${selectedIds.size === 1 ? "" : "s"}?`}
        description="This permanently removes each selected monitor along with its check history and incidents. This cannot be undone."
        confirmLabel="Delete"
        danger
        busy={bulkBusy}
        onConfirm={() => void handleBulkDelete()}
        onCancel={() => setBulkConfirmDelete(false)}
      />
    </div>
  );
}
