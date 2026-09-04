import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Activity, ArrowLeft, Lock } from "lucide-react";

import { apiClient, ApiError } from "../../api/client";
import { setStoredAccessKey, UNAUTHORIZED_EVENT } from "../../lib/accessKey";
import { Landing } from "../../pages/Landing";
import { Spinner } from "./Spinner";

type GateStatus = "checking" | "unlocked" | "locked";

/** Gates the whole app behind the shared API access key, when the backend
 * has one configured. A lightweight authenticated GET is used to probe
 * whether a key is required at all -- if the backend has no
 * API_ACCESS_KEY set (local dev), this succeeds immediately and the gate
 * never shows (and neither does the public landing page below -- that's
 * only useful in front of a real deployment's access-key gate). */
export function AccessGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<GateStatus>("checking");
  const [showSignInForm, setShowSignInForm] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const probe = useCallback(async () => {
    try {
      await apiClient.get("/api/monitors");
      setStatus("unlocked");
    } catch (err) {
      // Check the error *code*, not just a 401 status -- this same probe
      // request also exercises the nested per-user login check (AuthGate),
      // which is a 401 with a different code (INVALID_SESSION). Only
      // "UNAUTHORIZED" means the access key itself is the problem; anything
      // else (including "not logged in yet") should pass through to
      // children and let AuthGate or the app's own error states handle it.
      if (err instanceof ApiError && err.code === "UNAUTHORIZED") {
        setStatus("locked");
      } else {
        setStatus("unlocked");
      }
    }
  }, []);

  useEffect(() => {
    void probe();
  }, [probe]);

  useEffect(() => {
    const handler = () => {
      // client.ts dispatches this on *every* 401 with this code -- including
      // the very first mount-time probe, before the user has seen anything.
      // Only treat it as "a previously-unlocked session got revoked" (skip
      // straight to the key form) when we're past that initial check;
      // otherwise let probe()'s own catch block transition to "locked"
      // normally, showing the landing page first.
      setStatus((current) => {
        if (current === "checking") return current;
        setShowSignInForm(true);
        return "locked";
      });
    };
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
      if (err instanceof ApiError && err.code === "UNAUTHORIZED") {
        setError("Incorrect access key.");
      } else if (err instanceof ApiError && err.code === "INVALID_SESSION") {
        // Access key was accepted; the 401 came from the (unrelated) user
        // login check further down the chain -- so the key itself is fine.
        setStatus("unlocked");
      } else {
        setError("Unable to reach the server.");
      }
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

  if (status === "locked" && !showSignInForm) {
    return <Landing onSignIn={() => setShowSignInForm(true)} />;
  }

  if (status === "locked") {
    return (
      <div className="flex h-screen items-center justify-center bg-bg px-4">
        <form onSubmit={(e) => void handleSubmit(e)} className="card-base w-full max-w-sm p-6">
          <button
            type="button"
            onClick={() => setShowSignInForm(false)}
            className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-text"
          >
            <ArrowLeft size={13} />
            Back
          </button>

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
