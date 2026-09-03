import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Activity, Lock } from "lucide-react";

import { apiClient, ApiError } from "../../api/client";
import { setStoredAccessKey, UNAUTHORIZED_EVENT } from "../../lib/accessKey";
import { Spinner } from "./Spinner";

type GateStatus = "checking" | "unlocked" | "locked";

/** Gates the whole app behind the shared API access key, when the backend
 * has one configured. A lightweight authenticated GET is used to probe
 * whether a key is required at all -- if the backend has no
 * API_ACCESS_KEY set (local dev), this succeeds immediately and the gate
 * never shows. */
export function AccessGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<GateStatus>("checking");
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const probe = useCallback(async () => {
    try {
      await apiClient.get("/api/monitors");
      setStatus("unlocked");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setStatus("locked");
      } else {
        // A network hiccup shouldn't lock the user out -- let the app's own
        // per-page error states handle a genuinely unreachable backend.
        setStatus("unlocked");
      }
    }
  }, []);

  useEffect(() => {
    void probe();
  }, [probe]);

  useEffect(() => {
    const handler = () => setStatus("locked");
    window.addEventListener(UNAUTHORIZED_EVENT, handler);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setStoredAccessKey(input.trim());
    try {
      await apiClient.get("/api/monitors");
      setStatus("unlocked");
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? "Incorrect access key." : "Unable to reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "checking") {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <Spinner label="Loading…" />
      </div>
    );
  }

  if (status === "locked") {
    return (
      <div className="flex h-screen items-center justify-center bg-bg px-4">
        <form onSubmit={(e) => void handleSubmit(e)} className="card-base w-full max-w-sm p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent-dim text-accent">
              <Activity size={16} />
            </span>
            <span className="text-base font-semibold text-text">APIWatch</span>
          </div>

          <div className="mb-4 flex items-center gap-2 text-sm text-muted">
            <Lock size={14} />
            This deployment is protected. Enter the access key to continue.
          </div>

          <label className="label-base" htmlFor="access-key">
            Access Key
          </label>
          <input
            id="access-key"
            type="password"
            autoFocus
            className="input-base"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            required
          />
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}

          <button type="submit" className="btn-primary mt-4 w-full" disabled={submitting || !input.trim()}>
            {submitting ? <Spinner /> : "Unlock"}
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
