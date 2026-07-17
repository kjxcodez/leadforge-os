import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "../components/ui/sonner";
import { UIProvider } from "../stores/ui-store";
import { SettingsProvider } from "../stores/settings-store";
import { AuthProvider } from "../stores/auth-store";
import { WorkspaceProvider } from "../stores/workspace-store";
import { ThemeApplier } from "./ThemeProvider";
import { TooltipProvider } from "../components/ui/tooltip";

// ---------------------------------------------------------------------------
// Global QueryClient
// ---------------------------------------------------------------------------

/**
 * Singleton QueryClient configured for the desktop app.
 * - No window-focus refetch (desktop app, not a browser tab)
 * - 1 retry on failure — fast failure UX for Electron
 * - 5 min staleTime — data stays fresh while user works
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
    mutations: {
      retry: 0,
    },
  },
});

// ---------------------------------------------------------------------------
// AppProviders
// ---------------------------------------------------------------------------

interface AppProvidersProps {
  children: React.ReactNode;
}

/**
 * AppProviders composes all global providers in the correct dependency order.
 *
 * Order matters:
 * 1. UIProvider — Theme state drives ThemeApplier
 * 2. SettingsProvider — User preferences independent of auth
 * 3. AuthProvider — Session state
 * 4. WorkspaceProvider — Depends on auth being known
 * 5. QueryClientProvider — Wraps all data-fetching consumers
 * 6. ThemeApplier — Reads UIStore and applies CSS class to DOM
 * 7. Toaster — Needs to be inside the tree for portal rendering
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <UIProvider>
        <SettingsProvider>
          <AuthProvider>
            <WorkspaceProvider>
              <ThemeApplier />
              <TooltipProvider>{children}</TooltipProvider>
              <Toaster position="bottom-right" />
            </WorkspaceProvider>
          </AuthProvider>
        </SettingsProvider>
      </UIProvider>
    </QueryClientProvider>
  );
}
