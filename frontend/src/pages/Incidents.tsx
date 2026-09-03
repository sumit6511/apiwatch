import { AlertCircle } from "lucide-react";

import { useAllIncidents } from "../hooks/useIncidents";
import { IncidentCard } from "../components/incidents/IncidentCard";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { Spinner } from "../components/common/Spinner";

export function Incidents() {
  const incidentsQuery = useAllIncidents();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-title">Incidents</h1>
        <p className="mt-1 text-sm text-muted">A history of outages across every monitor.</p>
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

      {incidentsQuery.data && incidentsQuery.data.length > 0 && (
        <div className="flex flex-col gap-3">
          {incidentsQuery.data.map((incident) => (
            <IncidentCard key={incident.id} incident={incident} showMonitorName />
          ))}
        </div>
      )}
    </div>
  );
}
