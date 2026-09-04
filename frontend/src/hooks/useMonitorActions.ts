import { useState } from "react";

import type { Monitor } from "../types";
import { useToast } from "../components/common/Toast";
import { useDeleteMonitor, usePauseMonitor, useResumeMonitor, useRunManualCheck } from "./useMonitors";

/** Pause/resume, run-check, and delete -- shared by every place a monitor
 * can be acted on (the card grid, the list-view row, and previously
 * duplicated between them). Keeps the toast copy and error handling in
 * exactly one place so the two views can't quietly drift apart. */
export function useMonitorActions(monitor: Monitor) {
  const { showToast } = useToast();
  const pauseMonitor = usePauseMonitor();
  const resumeMonitor = useResumeMonitor();
  const runCheck = useRunManualCheck();
  const deleteMonitor = useDeleteMonitor();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handlePauseResume = async () => {
    try {
      if (monitor.is_active) {
        await pauseMonitor.mutateAsync(monitor.id);
        showToast("success", `${monitor.name} paused`);
      } else {
        await resumeMonitor.mutateAsync(monitor.id);
        showToast("success", `${monitor.name} resumed`);
      }
    } catch {
      showToast("error", "Unable to update monitor");
    }
  };

  const handleRunCheck = async () => {
    try {
      await runCheck.mutateAsync(monitor.id);
      showToast("success", "Health check completed");
    } catch {
      showToast("error", "Health check failed to run");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMonitor.mutateAsync(monitor.id);
      showToast("success", `${monitor.name} deleted`);
    } catch {
      showToast("error", "Unable to delete monitor");
    } finally {
      setConfirmDelete(false);
    }
  };

  return {
    handlePauseResume,
    handleRunCheck,
    handleDelete,
    confirmDelete,
    setConfirmDelete,
    deletePending: deleteMonitor.isPending,
  };
}
