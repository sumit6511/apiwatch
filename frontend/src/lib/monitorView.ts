export type MonitorView = "grid" | "list";

const STORAGE_KEY = "apiwatch_monitor_view";

export function getStoredMonitorView(): MonitorView {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

export function setStoredMonitorView(view: MonitorView): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, view);
  } catch {
    // Storage unavailable (private mode, etc.) -- the toggle still works
    // for this page load, it just won't be remembered next time.
  }
}
