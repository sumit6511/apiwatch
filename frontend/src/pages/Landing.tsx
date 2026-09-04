import {
  Activity,
  AlertCircle,
  Bell,
  Code2,
  LineChart,
  Lock,
  ShieldCheck,
  Zap,
} from "lucide-react";

const FEATURES = [
  {
    icon: Activity,
    title: "Real-Time Monitoring",
    description: "Configurable interval checks with automatic UP/DOWN classification and response-time tracking.",
  },
  {
    icon: AlertCircle,
    title: "Smart Incident Tracking",
    description: "One incident per outage, not one alert per failed check — with configurable failure/recovery thresholds.",
  },
  {
    icon: Bell,
    title: "Multi-Channel Alerts",
    description: "Discord, Telegram, and Email notifications the moment something breaks, and again when it recovers.",
  },
  {
    icon: ShieldCheck,
    title: "SSRF-Hardened",
    description: "Every monitored URL is validated against private networks, loopback addresses, and cloud metadata endpoints.",
  },
  {
    icon: LineChart,
    title: "Uptime Analytics",
    description: "Response-time charts and uptime percentages computed from real check history — never fabricated.",
  },
  {
    icon: Lock,
    title: "Secure by Design",
    description: "Encrypted credentials at rest, per-account data isolation, and rate-limited APIs against abuse.",
  },
];

export function Landing({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent-dim text-accent">
            <Activity size={17} />
          </span>
          <span className="text-base font-semibold tracking-tight">APIWatch</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://github.com/sumit6511/apiwatch"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost"
          >
            <Code2 size={16} />
            <span className="hidden sm:inline">View Source</span>
          </a>
          <button type="button" onClick={onSignIn} className="btn-primary">
            Sign In
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-20 pt-12 sm:pt-20">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            Monitor your APIs.
            <br />
            Detect failures before your users do.
          </h1>
          <p className="mt-5 text-base text-muted sm:text-lg">
            A lightweight, self-hosted uptime and API monitoring platform. Track response time,
            detect outages, and get alerted the moment something breaks.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <button type="button" onClick={onSignIn} className="btn-primary">
              <Zap size={16} />
              Sign In to Get Started
            </button>
            <a
              href="https://github.com/sumit6511/apiwatch"
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
            >
              <Code2 size={16} />
              View on GitHub
            </a>
          </div>
        </div>

        <div className="mt-20 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="card-base p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-dim text-accent">
                <feature.icon size={18} />
              </span>
              <h3 className="mt-3 text-sm font-semibold text-text">{feature.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{feature.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <p className="text-xs uppercase tracking-wide text-muted">Built with</p>
          <div className="mono-value flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-muted">
            <span>React</span>
            <span aria-hidden="true">·</span>
            <span>TypeScript</span>
            <span aria-hidden="true">·</span>
            <span>FastAPI</span>
            <span aria-hidden="true">·</span>
            <span>MongoDB Atlas</span>
            <span aria-hidden="true">·</span>
            <span>APScheduler</span>
          </div>
        </div>
      </main>
    </div>
  );
}
