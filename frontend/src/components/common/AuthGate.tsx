import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Activity, UserRound } from "lucide-react";

import { authApi } from "../../api/auth";
import { ApiError } from "../../api/client";
import type { User } from "../../types";
import { clearStoredUserToken, setStoredUserToken, USER_UNAUTHORIZED_EVENT } from "../../lib/authToken";
import { Spinner } from "./Spinner";

type GateStatus = "checking" | "authenticated" | "unauthenticated";
type Mode = "login" | "signup";

interface AuthContextValue {
  user: User;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthGate");
  }
  return context;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<GateStatus>("checking");
  const [user, setUser] = useState<User | null>(null);

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const probe = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUser(me);
      setStatus("authenticated");
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_SESSION") {
        setStatus("unauthenticated");
      } else {
        // A transient/network failure shouldn't force a re-login -- leave
        // status as "checking" briefly is wrong too, so fall back to the
        // login screen; the user can retry, and this avoids ever getting
        // stuck on a spinner forever.
        setStatus("unauthenticated");
      }
    }
  }, []);

  useEffect(() => {
    void probe();
  }, [probe]);

  useEffect(() => {
    const handler = () => {
      setUser(null);
      setStatus("unauthenticated");
    };
    window.addEventListener(USER_UNAUTHORIZED_EVENT, handler);
    return () => window.removeEventListener(USER_UNAUTHORIZED_EVENT, handler);
  }, []);

  function logout() {
    clearStoredUserToken();
    setUser(null);
    setStatus("unauthenticated");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = mode === "login" ? await authApi.login(email, password) : await authApi.signup(email, password);
      setStoredUserToken(result.token);
      setUser(result.user);
      setStatus("authenticated");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
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

  if (status === "unauthenticated") {
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
            <UserRound size={14} />
            {mode === "login" ? "Log in to your account." : "Create an account."}
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label className="label-base" htmlFor="auth-email">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                autoFocus
                autoComplete="email"
                className="input-base"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label-base" htmlFor="auth-password">
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="input-base"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={mode === "signup" ? 8 : undefined}
                required
              />
              {mode === "signup" && <p className="field-hint">At least 8 characters.</p>}
            </div>
          </div>

          {error && <p className="mt-2 text-sm text-danger">{error}</p>}

          <button type="submit" className="btn-primary mt-4 w-full" disabled={submitting}>
            {submitting ? <Spinner /> : mode === "login" ? "Log In" : "Sign Up"}
          </button>

          <button
            type="button"
            className="mt-3 w-full text-center text-xs text-muted hover:text-text"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError(null);
            }}
          >
            {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
          </button>
        </form>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <AuthContext.Provider value={{ user, logout }}>{children}</AuthContext.Provider>;
}
