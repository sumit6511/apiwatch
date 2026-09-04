import { useNavigate } from "react-router-dom";
import { MoreVertical, Pause, Pencil, Play, Trash2, Zap } from "lucide-react";

import type { Monitor } from "../../types";
import { StatusIndicator } from "../common/Status";
import { MethodBadge } from "../common/MethodBadge";
import { DropdownMenu, DropdownMenuItem } from "../common/DropdownMenu";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { Sparkline } from "../charts/Sparkline";
import { useChecks } from "../../hooks/useChecks";
import { useMonitorActions } from "../../hooks/useMonitorActions";
import { formatRelativeTime, formatResponseTimeOrStatus, formatUptime } from "../../lib/format";

export function MonitorCard({ monitor }: { monitor: Monitor }) {
  const navigate = useNavigate();
  const { data: checks } = useChecks(monitor.id, 20);
  const { handlePauseResume, handleRunCheck, handleDelete, confirmDelete, setConfirmDelete, deletePending } =
    useMonitorActions(monitor);

  const sparklinePoints = (checks ?? [])
    .slice()
    .reverse()
    .map((c) => ({ value: c.response_time_ms, status: c.status }));

  return (
    <div className="card-interactive group relative flex flex-col p-4">
      <button
        type="button"
        onClick={() => navigate(`/monitors/${monitor.id}`)}
        className="absolute inset-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        aria-label={`View ${monitor.name} details`}
      />

      {/* Not `relative` -- that would promote this row into the same
          positioned/z-index:auto stacking layer as the absolute overlay
          button above, and (being later in the DOM) paint over it, silently
          blocking clicks on the name/status text from reaching the button.
          Staying a plain static element keeps it *behind* the overlay, so
          clicks here fall through to "View details" like the rest of the
          card; the dropdown menu below opts back in with its own
          `relative z-10` since it needs its own click target. */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <StatusIndicator status={monitor.status} />
          <h3 className="mt-1 truncate text-sm font-semibold text-text">{monitor.name}</h3>
        </div>
        <div className="relative z-10 shrink-0">
          <DropdownMenu trigger={<MoreVertical size={16} />} label={`Actions for ${monitor.name}`}>
            <DropdownMenuItem icon={<Zap size={14} />} onClick={() => void handleRunCheck()}>
              Run check
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={monitor.is_active ? <Pause size={14} /> : <Play size={14} />}
              onClick={() => void handlePauseResume()}
            >
              {monitor.is_active ? "Pause" : "Resume"}
            </DropdownMenuItem>
            <DropdownMenuItem icon={<Pencil size={14} />} onClick={() => navigate(`/monitors/${monitor.id}/edit`)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem icon={<Trash2 size={14} />} danger onClick={() => setConfirmDelete(true)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-muted">
        <MethodBadge method={monitor.method} />
        <span className="mono-value truncate">{monitor.url}</span>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div className="mono-value text-sm text-text">
          {monitor.http_status ?? "—"}
          <span className="ml-2 text-muted">
            {formatResponseTimeOrStatus(monitor.http_status, monitor.response_time_ms)}
          </span>
        </div>
        <div className="mono-value text-xs text-muted">{formatUptime(monitor.uptime?.period_24h ?? null)} uptime</div>
      </div>

      <div className="mt-3">
        <Sparkline points={sparklinePoints} />
      </div>

      <div className="mt-3 text-xs text-muted">Checked {formatRelativeTime(monitor.last_checked_at)}</div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${monitor.name}?`}
        description="This permanently removes the monitor along with its check history and incidents. This cannot be undone."
        confirmLabel="Delete monitor"
        danger
        busy={deletePending}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
