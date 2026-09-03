import { CheckCircle2, XCircle } from "lucide-react";

import type { ManualCheckResult } from "../../types";
import { formatResponseTime } from "../../lib/format";
import { Spinner } from "../common/Spinner";

export function TestRequestPanel({
  onTest,
  pending,
  result,
  error,
}: {
  onTest: () => void;
  pending: boolean;
  result: ManualCheckResult | null;
  error: string | null;
}) {
  return (
    <div className="card-base p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text">Test this request</h3>
          <p className="mt-0.5 text-xs text-muted">
            Send one request with the current settings without creating a monitor.
          </p>
        </div>
        <button type="button" className="btn-secondary shrink-0" onClick={onTest} disabled={pending}>
          {pending ? <Spinner /> : "Test Request"}
        </button>
      </div>

      {result && (
        <div className="mt-4 border-t border-edge pt-4">
          {result.status === "UP" ? (
            <div className="flex items-center gap-2 text-sm font-medium status-up">
              <CheckCircle2 size={16} />
              Request successful
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm font-medium status-down">
              <XCircle size={16} />
              Request failed
            </div>
          )}
          <dl className="mono-value mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted">Status</dt>
              <dd className="text-text">{result.http_status ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Response time</dt>
              <dd className="text-text">{formatResponseTime(result.response_time_ms)}</dd>
            </div>
          </dl>
          {result.error && <p className="mt-3 text-sm text-danger">{result.error}</p>}
        </div>
      )}

      {error && (
        <div className="mt-4 border-t border-edge pt-4">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}
    </div>
  );
}
