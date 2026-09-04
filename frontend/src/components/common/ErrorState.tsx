import { AlertTriangle } from "lucide-react";

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="card-base flex flex-col items-center gap-4 px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-dim text-danger">
        <AlertTriangle size={28} aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-text">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-secondary mt-2">
          Retry
        </button>
      )}
    </div>
  );
}
