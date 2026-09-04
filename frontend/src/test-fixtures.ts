import type { Check, Incident, Monitor } from "./types";

export function makeMonitor(overrides: Partial<Monitor> = {}): Monitor {
  return {
    id: "monitor-1",
    name: "GitHub API",
    url: "https://api.github.com",
    method: "GET",
    headers: {},
    body: null,
    interval_seconds: 300,
    timeout_seconds: 10,
    expected_status_codes: [200],
    notification_channel_ids: [],
    is_public: false,
    tags: [],
    is_active: true,
    status: "UP",
    http_status: 200,
    response_time_ms: 183,
    failure_count: 0,
    success_count: 42,
    last_checked_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    last_failure_at: null,
    uptime: { period_24h: 99.98, period_7d: 99.91, period_30d: 99.87 },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function makeCheck(overrides: Partial<Check> = {}): Check {
  return {
    id: "check-1",
    monitor_id: "monitor-1",
    status: "UP",
    http_status: 200,
    response_time_ms: 183,
    error: null,
    checked_at: new Date().toISOString(),
    ...overrides,
  };
}

export function makeIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: "incident-1",
    monitor_id: "monitor-1",
    monitor_name: "GitHub API",
    status: "OPEN",
    reason: "HTTP 503",
    started_at: new Date().toISOString(),
    resolved_at: null,
    duration_seconds: null,
    ...overrides,
  };
}
