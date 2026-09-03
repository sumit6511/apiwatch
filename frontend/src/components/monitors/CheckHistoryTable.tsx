import { Check as CheckIcon, X as XIcon } from "lucide-react";

import type { Check } from "../../types";
import { formatResponseTime, formatTimestamp } from "../../lib/format";

export function CheckHistoryTable({ checks }: { checks: Check[] }) {
  if (checks.length === 0) {
    return <div className="text-sm text-muted">No checks recorded yet.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-edge text-xs uppercase tracking-wide text-muted">
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 pr-4 font-medium">Code</th>
            <th className="py-2 pr-4 font-medium">Response</th>
            <th className="py-2 pr-4 font-medium">Time</th>
            <th className="py-2 font-medium">Error</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((check) => (
            <tr key={check.id} className="border-b border-edge/60 last:border-0">
              <td className="py-2 pr-4">
                {check.status === "UP" ? (
                  <span className="inline-flex items-center gap-1 status-up">
                    <CheckIcon size={14} />
                    <span className="sr-only">Up</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 status-down">
                    <XIcon size={14} />
                    <span className="sr-only">Down</span>
                  </span>
                )}
              </td>
              <td className="mono-value py-2 pr-4 text-text">{check.http_status ?? "—"}</td>
              <td className="mono-value py-2 pr-4 text-text">{formatResponseTime(check.response_time_ms)}</td>
              <td className="mono-value py-2 pr-4 text-muted">{formatTimestamp(check.checked_at)}</td>
              <td className="max-w-64 truncate py-2 text-muted" title={check.error ?? undefined}>
                {check.error ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
