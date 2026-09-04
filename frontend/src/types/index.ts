export type MonitorStatus = "UP" | "DOWN" | "PAUSED" | "UNKNOWN";
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
export type IncidentStatus = "OPEN" | "RESOLVED";
export type Period = "24h" | "7d" | "30d";
export type NotificationType = "discord" | "telegram" | "email";

export interface UptimeSummary {
  period_24h: number | null;
  period_7d: number | null;
  period_30d: number | null;
}

export interface Monitor {
  id: string;
  name: string;
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  body: Record<string, unknown> | string | null;
  interval_seconds: number;
  timeout_seconds: number;
  expected_status_codes: number[];
  notification_channel_ids: string[];
  is_public: boolean;
  tags: string[];
  is_active: boolean;
  status: MonitorStatus;
  http_status: number | null;
  response_time_ms: number | null;
  failure_count: number;
  success_count: number;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  uptime: UptimeSummary | null;
  created_at: string;
  updated_at: string;
}

export interface MonitorCreateInput {
  name: string;
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  body: Record<string, unknown> | string | null;
  interval_seconds: number;
  timeout_seconds: number;
  expected_status_codes: number[];
  notification_channel_ids: string[];
  is_public: boolean;
  tags: string[];
}

export type MonitorUpdateInput = Partial<MonitorCreateInput>;

export interface MonitorTestRequestInput {
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  body: Record<string, unknown> | string | null;
  timeout_seconds: number;
  expected_status_codes: number[];
}

export interface Check {
  id: string;
  monitor_id: string;
  status: MonitorStatus;
  http_status: number | null;
  response_time_ms: number;
  error: string | null;
  checked_at: string;
}

export interface ManualCheckResult {
  status: MonitorStatus;
  http_status: number | null;
  response_time_ms: number;
  error: string | null;
}

export interface MetricPoint {
  timestamp: string;
  response_time_ms: number;
  status: MonitorStatus;
  http_status: number | null;
}

export interface UptimeStats {
  period: Period;
  uptime_percentage: number | null;
  total_checks: number;
  successful_checks: number;
  failed_checks: number;
}

export interface Incident {
  id: string;
  monitor_id: string;
  monitor_name: string | null;
  status: IncidentStatus;
  reason: string;
  started_at: string;
  resolved_at: string | null;
  duration_seconds: number | null;
}

export interface NotificationChannel {
  id: string;
  type: NotificationType;
  name: string;
  target_masked: string;
  enabled: boolean;
  created_at: string;
}

/** Which fields are required depends on `type` (backend validates this
 * together) -- webhook_url for discord, bot_token+chat_id for telegram,
 * to_email for email. */
export interface NotificationChannelCreateInput {
  type: NotificationType;
  name: string;
  enabled: boolean;
  webhook_url?: string;
  bot_token?: string;
  chat_id?: string;
  to_email?: string;
}

export interface NotificationChannelUpdateInput {
  name?: string;
  enabled?: boolean;
  webhook_url?: string;
  bot_token?: string;
  chat_id?: string;
  to_email?: string;
}

export interface NotificationTestResult {
  success: boolean;
  message: string;
}

export interface DashboardSummary {
  total_monitors: number;
  operational: number;
  down: number;
  paused: number;
  unknown: number;
  overall_uptime_percentage: number | null;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface TokenResponse {
  token: string;
  user: User;
}

export interface PublicCheckPoint {
  timestamp: string;
  status: MonitorStatus;
  response_time_ms: number;
}

/** Deliberately excludes the target URL, headers, and body -- a public
 * status page only ever shows the owner-chosen name and status/uptime. */
export interface PublicMonitorStatus {
  name: string;
  status: MonitorStatus;
  uptime_24h: number | null;
  uptime_7d: number | null;
  uptime_30d: number | null;
  last_checked_at: string | null;
  recent_checks: PublicCheckPoint[];
}

export interface PublicStatusPage {
  overall_status: MonitorStatus;
  monitors: PublicMonitorStatus[];
  generated_at: string;
}

export interface StatusPageSlug {
  slug: string;
}
