import { Loader2 } from "lucide-react";

export function Spinner({ label, size = 16 }: { label?: string; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted">
      <Loader2 size={size} className="animate-spin" aria-hidden="true" />
      {label && <span>{label}</span>}
      {!label && <span className="sr-only">Loading…</span>}
    </span>
  );
}
