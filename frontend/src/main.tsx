import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "virtual:uno.css";
import "./styles/theme.css";

import { AppRouter } from "./app/router";
import { ToastProvider } from "./components/common/Toast";
import { AccessGate } from "./components/common/AccessGate";
import { AuthGate } from "./components/common/AuthGate";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}

// AccessGate/AuthGate wrap the whole app *outside* the router (they gate on
// mount, before any route even resolves), so a public status page --
// meant to be viewable with neither the deployment access key nor an
// account -- has to bypass them here rather than via a route-level check.
const isPublicStatusPage = window.location.pathname.startsWith("/status/");

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {isPublicStatusPage ? (
          <AppRouter />
        ) : (
          <AccessGate>
            <AuthGate>
              <AppRouter />
            </AuthGate>
          </AccessGate>
        )}
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
