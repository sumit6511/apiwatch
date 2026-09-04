import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { AppShell } from "../components/layout/AppShell";
import { Dashboard } from "../pages/Dashboard";
import { Incidents } from "../pages/Incidents";
import { Settings } from "../pages/Settings";
import { NotFound } from "../pages/NotFound";
import { PublicStatus } from "../pages/PublicStatus";
import { Spinner } from "../components/common/Spinner";

// MonitorDetails pulls in Recharts, the single heaviest dependency in the
// app -- lazy-load it so the initial bundle (dashboard, forms, settings)
// stays small and only the detail page pays for the chart library.
const MonitorDetails = lazy(() =>
  import("../pages/MonitorDetails").then((m) => ({ default: m.MonitorDetails })),
);
const MonitorForm = lazy(() => import("../pages/MonitorForm").then((m) => ({ default: m.MonitorForm })));

function PageFallback() {
  return (
    <div className="flex justify-center py-12">
      <Spinner label="Loading…" />
    </div>
  );
}

function lazyPage(node: React.ReactNode) {
  return <Suspense fallback={<PageFallback />}>{node}</Suspense>;
}

const router = createBrowserRouter([
  // Public, unauthenticated -- outside AppShell (no sidebar/topbar chrome)
  // and, per main.tsx, outside AccessGate/AuthGate entirely. Sharing this
  // link must not require the deployment access key or an account.
  { path: "/status/:slug", element: <PublicStatus /> },
  {
    element: <AppShell />,
    errorElement: <NotFound />,
    children: [
      { path: "/", element: <Dashboard /> },
      // "Overview" and "Monitors" are two nav entries into the same
      // metric-cards-plus-grid view (see spec sections 55/57-59) -- kept as
      // one component mounted at both paths rather than duplicating it.
      { path: "/monitors", element: <Dashboard /> },
      { path: "/monitors/new", element: lazyPage(<MonitorForm mode="create" />) },
      { path: "/monitors/:id/edit", element: lazyPage(<MonitorForm mode="edit" />) },
      { path: "/monitors/:id", element: lazyPage(<MonitorDetails />) },
      { path: "/incidents", element: <Incidents /> },
      { path: "/settings", element: <Settings /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
