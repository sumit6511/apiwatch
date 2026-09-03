import type { MonitorStatus } from "../../types";

interface StatusMeta {
  label: string;
  dotClass: string;
  textClass: string;
  badgeClass: string;
}

const STATUS_META: Record<MonitorStatus, StatusMeta> = {
  UP: {
    label: "Operational",
    dotClass: "bg-success",
    textClass: "status-up",
    badgeClass: "bg-success-dim status-up",
  },
  DOWN: {
    label: "Down",
    dotClass: "bg-danger",
    textClass: "status-down",
    badgeClass: "bg-danger-dim status-down",
  },
  PAUSED: {
    label: "Paused",
    dotClass: "bg-muted",
    textClass: "status-paused",
    badgeClass: "bg-surface2 status-paused",
  },
  UNKNOWN: {
    label: "Pending",
    dotClass: "bg-warning",
    textClass: "status-unknown",
    badgeClass: "bg-warning-dim status-unknown",
  },
};

export function statusLabel(status: MonitorStatus): string {
  return STATUS_META[status].label;
}

/** A bare colored dot. Always pair with visible text nearby -- color alone
 * never communicates status (section 60/76). `srLabel` covers the rare case
 * where this dot is the only thing in its context. */
export function StatusDot({
  status,
  srLabel,
  pulse = false,
}: {
  status: MonitorStatus;
  srLabel?: string;
  pulse?: boolean;
}) {
  const meta = STATUS_META[status];
  return (
    <span className="relative inline-flex h-2.5 w-2.5 shrink-0">
      {pulse && status === "UP" && (
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${meta.dotClass} opacity-60`} />
      )}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${meta.dotClass}`} />
      {srLabel && <span className="sr-only">{srLabel}</span>}
    </span>
  );
}

/** Dot + label, for compact inline use (monitor card headers, tables). */
export function StatusIndicator({ status, className = "" }: { status: MonitorStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-2 text-sm font-medium ${meta.textClass} ${className}`}>
      <StatusDot status={status} />
      {meta.label}
    </span>
  );
}

/** A filled pill badge, for headers / detail pages where more emphasis is warranted. */
export function StatusBadge({ status, className = "" }: { status: MonitorStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${meta.badgeClass} ${className}`}
    >
      <StatusDot status={status} />
      {meta.label}
    </span>
  );
}
