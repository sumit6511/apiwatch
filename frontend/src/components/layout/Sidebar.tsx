import { NavLink } from "react-router-dom";
import { Activity, AlertCircle, LayoutGrid, LogOut, Settings as SettingsIcon } from "lucide-react";
import type { ReactNode } from "react";

import { useDashboardSummary } from "../../hooks/useDashboardSummary";
import { useAuth } from "../common/AuthGate";

const NAV_ITEMS: { to: string; label: string; icon: ReactNode; end?: boolean }[] = [
  { to: "/", label: "Overview", icon: <LayoutGrid size={18} />, end: true },
  { to: "/monitors", label: "Monitors", icon: <Activity size={18} /> },
  { to: "/incidents", label: "Incidents", icon: <AlertCircle size={18} /> },
];

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { data: summary } = useDashboardSummary();
  const { user, logout } = useAuth();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-dim text-accent">
          <Activity size={16} />
        </span>
        <span className="text-base font-semibold tracking-tight text-text">APIWatch</span>
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

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-edge bg-surface md:block">
      <SidebarContent />
    </aside>
  );
}
