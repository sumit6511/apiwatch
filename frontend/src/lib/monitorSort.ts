import type { Monitor, MonitorStatus } from "../types";

export type MonitorSortKey = "newest" | "name" | "status" | "uptime";

// Down first -- the whole point of sorting by status is triage, so the
// thing most likely to need attention belongs at the top.
const STATUS_RANK: Record<MonitorStatus, number> = { DOWN: 0, UNKNOWN: 1, PAUSED: 2, UP: 3 };

/** `monitors` is already newest-first from the API, so "newest" is a no-op
 * -- every other key returns a new sorted array rather than mutating. */
export function sortMonitors(monitors: Monitor[], sortKey: MonitorSortKey): Monitor[] {
  switch (sortKey) {
    case "name":
      return [...monitors].sort((a, b) => a.name.localeCompare(b.name));
    case "status":
      return [...monitors].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);
    case "uptime":
      // No uptime data yet reads as "unknown", not "100%" -- sorts with the
      // worst (lowest) uptime, alongside genuinely low-uptime monitors,
      // rather than hiding at the bottom next to the healthiest ones.
      return [...monitors].sort((a, b) => (a.uptime?.period_24h ?? -1) - (b.uptime?.period_24h ?? -1));
    case "newest":
    default:
      return monitors;
  }
}
