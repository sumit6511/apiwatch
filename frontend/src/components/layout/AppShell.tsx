import { useState } from "react";
import { Outlet } from "react-router-dom";

import { useRealtimeUpdates } from "../../hooks/useRealtimeUpdates";
import { Sidebar } from "./Sidebar";
import { MobileDrawer } from "./MobileDrawer";
import { Topbar } from "./Topbar";

export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Mounted exactly once here (not inside SidebarContent, which renders
  // twice at once when the mobile drawer is open) so there's a single
  // WebSocket connection per session, not one per rendered sidebar copy.
  const realtimeStatus = useRealtimeUpdates();

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text">
      <Sidebar realtimeStatus={realtimeStatus} />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} realtimeStatus={realtimeStatus} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setDrawerOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
