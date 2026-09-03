export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-surface2 ${className}`} aria-hidden="true" />;
}

export function MetricCardSkeleton() {
  return (
    <div className="card-base p-4">
      <Skeleton className="mb-3 h-3 w-20" />
      <Skeleton className="h-7 w-14" />
    </div>
  );
}

export function MonitorCardSkeleton() {
  return (
    <div className="card-base p-4">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-4" />
      </div>
      <Skeleton className="mb-2 h-3 w-full" />
      <Skeleton className="mb-4 h-3 w-2/3" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}
