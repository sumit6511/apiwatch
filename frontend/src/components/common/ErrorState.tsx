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
    <div className="card-base flex flex-col items-center gap-3 px-6 py-12 text-center">
      <AlertTriangle size={28} className="text-danger" aria-hidden="true" />
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
