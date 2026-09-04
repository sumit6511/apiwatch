import { useNavigate } from "react-router-dom";
import { MoreVertical, Pause, Pencil, Play, Trash2, Zap } from "lucide-react";

import type { Monitor } from "../../types";
import { StatusIndicator } from "../common/Status";
import { MethodBadge } from "../common/MethodBadge";
import { DropdownMenu, DropdownMenuItem } from "../common/DropdownMenu";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { useMonitorActions } from "../../hooks/useMonitorActions";
import { formatRelativeTime, formatResponseTimeOrStatus, formatUptime } from "../../lib/format";

/** A denser alternative to MonitorCard for accounts with many monitors --
 * same actions (via the shared useMonitorActions hook so the two views
 * can't drift apart), one line instead of a whole card. */
export function MonitorRow({ monitor }: { monitor: Monitor }) {
  const navigate = useNavigate();
  const { handlePauseResume, handleRunCheck, handleDelete, confirmDelete, setConfirmDelete, deletePending } =
    useMonitorActions(monitor);

  return (
    <div className="card-interactive relative flex items-center gap-4 px-4 py-3">
      <button
        type="button"
        onClick={() => navigate(`/monitors/${monitor.id}`)}
        className="absolute inset-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        aria-label={`View ${monitor.name} details`}
      />

      {/* See MonitorCard for why this row of content must stay a plain
          static element rather than `relative` -- it would otherwise paint
          over the overlay button above and swallow clicks meant for it. */}
      <StatusIndicator status={monitor.status} className="w-28 shrink-0" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-text">{monitor.name}</h3>
          <MethodBadge method={monitor.method} />
        </div>
        <div className="mono-value truncate text-xs text-muted">{monitor.url}</div>
      </div>

      <div className="mono-value hidden w-24 shrink-0 text-right text-xs text-muted sm:block">
        {formatResponseTimeOrStatus(monitor.http_status, monitor.response_time_ms)}
      </div>

      <div className="mono-value hidden w-20 shrink-0 text-right text-xs text-muted md:block">
        {formatUptime(monitor.uptime?.period_24h ?? null)} uptime
      </div>

      <div className="hidden w-32 shrink-0 text-right text-xs text-muted lg:block">
        Checked {formatRelativeTime(monitor.last_checked_at)}
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
