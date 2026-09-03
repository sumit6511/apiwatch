import type { MonitorStatus } from "../../types";

interface SparklinePoint {
  value: number;
  status: MonitorStatus;
}

/** A compact bar sparkline for monitor cards (section 59). Deliberately not
 * Recharts here -- a dozen tiny divs is lighter and simpler than mounting a
 * chart library per card; the full Recharts chart lives on the detail page. */
export function Sparkline({ points }: { points: SparklinePoint[] }) {
  if (points.length === 0) {
    return <div className="h-6 text-xs text-muted">No data yet</div>;
  }

  const max = Math.max(...points.map((p) => p.value), 1);

  return (
    <div className="flex h-6 items-end gap-0.5" role="img" aria-label="Recent response time history">
      {points.map((point, index) => {
        const heightPct = Math.max((point.value / max) * 100, 8);
        const color = point.status === "UP" ? "bg-accent/60" : "bg-danger";
        return (
          <span
            key={index}
            className={`flex-1 rounded-[1px] ${color}`}
            style={{ height: `${heightPct}%` }}
          />
        );
      })}
    </div>
  );
}
