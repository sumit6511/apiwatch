import { useMemo, useState } from "react";
import { AlertCircle, SearchX } from "lucide-react";

import { useAllIncidents } from "../hooks/useIncidents";
import { IncidentCard } from "../components/incidents/IncidentCard";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { Spinner } from "../components/common/Spinner";
import type { IncidentStatus } from "../types";

type StatusFilter = "all" | IncidentStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "RESOLVED", label: "Resolved" },
];

export function Incidents() {
  const incidentsQuery = useAllIncidents();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [monitorFilter, setMonitorFilter] = useState<string>("all");

  // Derived from whatever incidents are already loaded -- no separate
  // "list my monitors" call needed just to populate this dropdown.
  const monitorOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const incident of incidentsQuery.data ?? []) {
      if (incident.monitor_name) seen.set(incident.monitor_id, incident.monitor_name);
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [incidentsQuery.data]);

  const filteredIncidents = useMemo(() => {
    return (incidentsQuery.data ?? []).filter((incident) => {
      if (statusFilter !== "all" && incident.status !== statusFilter) return false;
      if (monitorFilter !== "all" && incident.monitor_id !== monitorFilter) return false;
      return true;
    });
  }, [incidentsQuery.data, statusFilter, monitorFilter]);

  const hasIncidents = Boolean(incidentsQuery.data && incidentsQuery.data.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Incidents</h1>
          <p className="mt-1 text-sm text-muted">A history of outages across every monitor.</p>
        </div>
        {hasIncidents && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-lg border border-edge p-0.5">
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    statusFilter === filter.value ? "bg-accent-dim text-accent" : "text-muted hover:text-text"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            {monitorOptions.length > 1 && (
              <select
                value={monitorFilter}
                onChange={(e) => setMonitorFilter(e.target.value)}
                className="input-base w-auto py-1.5 text-xs"
                aria-label="Filter by monitor"
              >
                <option value="all">All monitors</option>
                {monitorOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {incidentsQuery.isLoading && <Spinner label="Loading incidents…" />}

      {incidentsQuery.isError && (
        <ErrorState
          description="Please check your connection and try again."
          onRetry={() => void incidentsQuery.refetch()}
        />
      )}

      {incidentsQuery.data && incidentsQuery.data.length === 0 && (
        <EmptyState icon={<AlertCircle size={28} />} title="No incidents" description="Everything looks healthy." />
      )}

      {hasIncidents && filteredIncidents.length === 0 && (
        <EmptyState icon={<SearchX size={28} />} title="No incidents match your filters" />
      )}

      {filteredIncidents.length > 0 && (
        <div className="flex flex-col gap-3">
          {filteredIncidents.map((incident) => (
            <IncidentCard key={incident.id} incident={incident} showMonitorName={monitorFilter === "all"} />
          ))}
        </div>
      )}
    </div>
  );
}
