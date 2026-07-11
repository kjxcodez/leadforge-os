import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { SyncWorker } from "../sync/sync-worker";

import { useWorkspace } from "../hooks/useWorkspace";

import {
  SidebarInset,
  SidebarProvider,
} from "../components/ui/sidebar";
import AppHeader from "./AppHeader";
import { AppSidebar } from "./AppSidebar";


/**
 * AppLayout is the authenticated application shell.
 * It renders the sidebar, header, and the page content area via <Outlet />.
 * All auth and workspace state is read from their respective stores.
 */
export function AppLayout() {
  const { activeWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  useEffect(() => {
    const workspaceId = activeWorkspace?.id;
    if (workspaceId) {
      SyncWorker.start(queryClient, workspaceId);
    } else {
      SyncWorker.stop();
    }

    return () => {
      SyncWorker.stop();
    };
  }, [activeWorkspace?.id, queryClient]);

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
        <AppSidebar activeWorkspace={activeWorkspace} />

        <SidebarInset>
          <AppHeader />
          <div className="flex flex-col flex-1 min-w-0">
            {/* Page content */}
            <main className="flex-1 overflow-y-auto p-4">
              <Outlet />
            </main>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
