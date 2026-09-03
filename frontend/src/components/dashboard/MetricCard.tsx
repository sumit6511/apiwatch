import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  valueClassName?: string;
  icon?: ReactNode;
}

export function MetricCard({ label, value, valueClassName = "text-text", icon }: MetricCardProps) {
  return (
    <div className="card-base p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
        {icon && <span className="text-muted">{icon}</span>}
      </div>
      <div className={`mono-value mt-2 text-2xl font-semibold ${valueClassName}`}>{value}</div>
    </div>
  );
}
