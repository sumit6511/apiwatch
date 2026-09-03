import type { Check } from "../../types";
import { formatFullDateTime, formatResponseTime } from "../../lib/format";

export function StatusTimeline({ checks, periodLabel }: { checks: Check[]; periodLabel: string }) {
  if (checks.length === 0) {
    return <div className="text-sm text-muted">No checks recorded yet.</div>;
  }

  // Checks arrive newest-first; render oldest-to-newest, left-to-right.
  const chronological = checks.slice().reverse();

  return (
    <div>
      <div className="mb-2 text-xs text-muted">{periodLabel}</div>
      <div className="flex h-8 items-stretch gap-[2px]" role="img" aria-label={`Check status timeline, ${periodLabel}`}>
        {chronological.map((check) => (
          <span
            key={check.id}
            title={`${formatFullDateTime(check.checked_at)} — ${check.status}${
              check.http_status ? ` (${check.http_status})` : ""
            } — ${formatResponseTime(check.response_time_ms)}`}
            className={`flex-1 rounded-[2px] ${check.status === "UP" ? "bg-success" : "bg-danger"}`}
          />
        ))}
      </div>
      <ul className="sr-only">
        {chronological.map((check) => (
          <li key={check.id}>
            {formatFullDateTime(check.checked_at)}: {check.status}
            {check.http_status ? ` (HTTP ${check.http_status})` : ""}, {formatResponseTime(check.response_time_ms)}
          </li>
        ))}
      </ul>
    </div>
  );
}
