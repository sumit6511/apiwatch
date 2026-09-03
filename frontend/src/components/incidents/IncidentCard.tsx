import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import type { Incident } from "../../types";
import { formatDuration, formatFullDateTime } from "../../lib/format";

export function IncidentCard({ incident, showMonitorName = false }: { incident: Incident; showMonitorName?: boolean }) {
  const isOpen = incident.status === "OPEN";

  return (
    <div
      className={`card-base flex flex-col gap-2 p-4 ${
        isOpen ? "border-danger/40 bg-danger-dim" : ""
      }`}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        {isOpen ? (
          <span className="inline-flex items-center gap-1.5 status-down">
            <AlertCircle size={16} />
            Open
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 status-up">
            <CheckCircle2 size={16} />
            Resolved
          </span>
        )}
      </div>

      {showMonitorName && incident.monitor_name && (
        <Link to={`/monitors/${incident.monitor_id}`} className="text-sm font-semibold text-text hover:underline">
          {incident.monitor_name}
        </Link>
      )}

      <div className="mono-value text-sm text-text">{incident.reason}</div>

      <div className="mono-value flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <span>{formatFullDateTime(incident.started_at)}</span>
        {incident.resolved_at && (
          <>
            <span>→</span>
            <span>{formatFullDateTime(incident.resolved_at)}</span>
          </>
        )}
        {incident.duration_seconds !== null && (
          <span className="text-text">{formatDuration(incident.duration_seconds)}</span>
        )}
      </div>
    </div>
  );
}
