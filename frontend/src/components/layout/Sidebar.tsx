import { NavLink } from "react-router-dom";
import { AlertCircle, Activity, LayoutGrid, LogOut, Settings as SettingsIcon } from "lucide-react";
import type { ReactNode } from "react";

import { useDashboardSummary } from "../../hooks/useDashboardSummary";
import type { RealtimeStatus } from "../../hooks/useRealtimeUpdates";
import { useAuth } from "../common/AuthGate";

// One entry per distinct destination -- "Overview" and "Monitors" used to
// be two nav items pointing at the same rendered page (see app/router.tsx),
// which meant clicking between them changed nothing. Collapsed to one.
const NAV_ITEMS: { to: string; label: string; icon: ReactNode; end?: boolean }[] = [
  { to: "/", label: "Overview", icon: <LayoutGrid size={18} />, end: true },
  { to: "/incidents", label: "Incidents", icon: <AlertCircle size={18} /> },
];

const REALTIME_META: Record<RealtimeStatus, { label: string; dotClass: string }> = {
  connecting: { label: "Connecting…", dotClass: "bg-warning" },
  connected: { label: "Live", dotClass: "bg-success" },
  disconnected: { label: "Reconnecting…", dotClass: "bg-danger" },
};

function RealtimeIndicator({ status }: { status: RealtimeStatus }) {
  const meta = REALTIME_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted"
      title={status === "connected" ? "Live updates connected" : "Live updates unavailable -- falling back to polling"}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export function SidebarContent({
  onNavigate,
  realtimeStatus,
}: {
  onNavigate?: () => void;
  realtimeStatus: RealtimeStatus;
}) {
  const { data: summary } = useDashboardSummary();
  const { user, logout } = useAuth();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-dim text-accent">
            <Activity size={16} />
          </span>
          <span className="text-base font-semibold tracking-tight text-text">APIWatch</span>
        </div>
        <RealtimeIndicator status={realtimeStatus} />
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive ? "bg-accent-dim text-accent" : "text-muted hover:bg-surface2 hover:text-text"
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}

        {summary && (
          <div className="mt-2 flex flex-col gap-1 px-3 py-2 text-xs text-muted">
            <span>{summary.total_monitors} monitors</span>
            {summary.down > 0 && <span className="status-down">{summary.down} down</span>}
          </div>
        )}
      </nav>

      <div className="border-t border-edge px-3 py-3">
        <NavLink
          to="/settings"
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive ? "bg-accent-dim text-accent" : "text-muted hover:bg-surface2 hover:text-text"
            }`
          }
        >
          <SettingsIcon size={18} />
          Settings
        </NavLink>

        <div className="mt-2 flex items-center justify-between gap-2 px-3 py-1.5">
          <span className="truncate text-xs text-muted" title={user.email}>
            {user.email}
          </span>
          <button
            type="button"
            onClick={logout}
            className="icon-btn h-7 w-7 shrink-0"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ realtimeStatus }: { realtimeStatus: RealtimeStatus }) {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-edge bg-surface md:block">
      <SidebarContent realtimeStatus={realtimeStatus} />
    </aside>
  );
}
