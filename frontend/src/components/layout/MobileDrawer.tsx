import { useEffect } from "react";
import { X } from "lucide-react";

import type { RealtimeStatus } from "../../hooks/useRealtimeUpdates";
import { SidebarContent } from "./Sidebar";

export function MobileDrawer({
  open,
  onClose,
  realtimeStatus,
}: {
  open: boolean;
  onClose: () => void;
  realtimeStatus: RealtimeStatus;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="absolute inset-y-0 left-0 w-64 bg-surface shadow-xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="icon-btn absolute right-3 top-4"
          aria-label="Close navigation"
        >
          <X size={18} />
        </button>
        <SidebarContent onNavigate={onClose} realtimeStatus={realtimeStatus} />
      </div>
    </div>
  );
}
