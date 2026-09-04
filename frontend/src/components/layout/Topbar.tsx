import { Menu, Moon, Search, Settings as SettingsIcon, Sun } from "lucide-react";
import { Link, useLocation, useSearchParams } from "react-router-dom";

import { useTheme } from "../../hooks/useTheme";

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const searchApplies = location.pathname === "/" || location.pathname === "/monitors";
  const { theme, toggle: toggleTheme } = useTheme();

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-edge bg-surface px-4">
      <button
        type="button"
        onClick={onOpenMenu}
        className="icon-btn md:hidden"
        aria-label="Open navigation"
      >
        <Menu size={20} />
      </button>

      <Link to="/" className="text-sm font-semibold text-text md:hidden">
        APIWatch
      </Link>

      <div className="ml-auto flex items-center gap-2">
        {searchApplies && (
          <label className="relative hidden sm:block">
            <span className="sr-only">Search monitors</span>
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="search"
              placeholder="Search monitors…"
              value={searchParams.get("q") ?? ""}
              onChange={(event) => {
                const next = new URLSearchParams(searchParams);
                if (event.target.value) {
                  next.set("q", event.target.value);
                } else {
                  next.delete("q");
                }
                setSearchParams(next, { replace: true });
              }}
              className="input-base w-52 py-1.5 pl-8 text-sm"
            />
          </label>
        )}
        <button
          type="button"
          onClick={toggleTheme}
          className="icon-btn"
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <Link to="/settings" className="icon-btn" aria-label="Settings" title="Settings">
          <SettingsIcon size={18} />
        </Link>
      </div>
    </header>
  );
}
