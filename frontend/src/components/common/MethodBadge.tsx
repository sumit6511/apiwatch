import type { HttpMethod } from "../../types";

export function MethodBadge({ method }: { method: HttpMethod }) {
  return (
    <span className="mono-value inline-flex items-center rounded border border-edge bg-surface2 px-1.5 py-0.5 text-[11px] font-semibold text-muted">
      {method}
    </span>
  );
}
