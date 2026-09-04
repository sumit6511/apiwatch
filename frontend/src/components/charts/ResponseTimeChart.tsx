import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { MetricPoint } from "../../types";
import { formatResponseTime, formatTimestamp } from "../../lib/format";

interface ChartTooltipProps {
  active?: boolean;
  payload?: { payload: MetricPoint }[];
}

function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="card-base px-3 py-2 text-xs shadow-lg">
      <div className="mono-value text-text">{formatTimestamp(point.timestamp)}</div>
      <div className="mono-value mt-1 text-accent">{formatResponseTime(point.response_time_ms)}</div>
      <div className={point.status === "UP" ? "status-up" : "status-down"}>
        {point.status} {point.http_status ?? ""}
      </div>
    </div>
  );
}

export function ResponseTimeChart({ points }: { points: MetricPoint[] }) {
  // A single point has no trend to draw -- an area chart with one dot on an
  // otherwise-empty grid reads as broken, not "sparse". Same friendly
  // message as truly no data, one check earlier.
  if (points.length < 2) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted">
        Not enough data yet to draw a chart.
      </div>
    );
  }

  const values = points.map((p) => p.response_time_ms);
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted">
        <span>
          Avg <span className="mono-value text-text">{formatResponseTime(avg)}</span>
        </span>
        <span>
          Min <span className="mono-value text-text">{formatResponseTime(min)}</span>
        </span>
        <span>
          Max <span className="mono-value text-text">{formatResponseTime(max)}</span>
        </span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="responseTimeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--aw-accent)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--aw-accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--aw-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(value: string) => formatTimestamp(value)}
            stroke="var(--aw-muted)"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: "var(--aw-border)" }}
            minTickGap={40}
          />
          <YAxis
            stroke="var(--aw-muted)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(value: number) => formatResponseTime(value)}
          />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="response_time_ms"
            stroke="var(--aw-accent)"
            strokeWidth={2}
            fill="url(#responseTimeFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
