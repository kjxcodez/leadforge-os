import { useEffect, Suspense } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useWorkspace } from '../hooks/useWorkspace';
import { Skeleton } from '../components/ui/skeleton';
import { SidebarInset, SidebarProvider } from '../components/ui/sidebar';
import AppHeader from './AppHeader';
import { AppSidebar } from '../components/sidebar/AppSidebar';
import { CreateWorkspaceForm } from '../components/workspace/CreateWorkspaceForm';
import ProductTour from '../components/onboarding/ProductTour';

/**
 * AppLayout — the authenticated application shell.
 *
 * Renders: AppSidebar → AppHeader → page content via <Outlet />.
 * Auth and workspace state are read from their respective stores — no prop drilling.
 *
 * Emits `electron:ready-to-show` when there is no active workspace (so the
 * window frame appears even before a workspace is selected).
 */
export function AppLayout() {
  const { activeWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Redirect to onboarding if not completed
  useEffect(() => {
    const isCompleted = localStorage.getItem('onboarding_completed') === 'true';
    if (!isCompleted) {
      navigate('/onboarding');
    }
  }, [navigate]);

  // Show window frame even when no workspace exists
  useEffect(() => {
    if (!activeWorkspace) {
      window.ipc.invoke('electron:ready-to-show' as any, null).catch(() => {});
    }
  }, [activeWorkspace]);

  // Invalidate all queries when a sync completes
  useEffect(() => {
    const workspaceId = activeWorkspace?.id;
    if (!workspaceId) return;

    const unsubscribe = window.ipc.on('sync:completed', () => {
      console.log('[Renderer] Sync completed — invalidating queries.');
      queryClient.invalidateQueries();
    });

    return () => {
      unsubscribe();
    };
  }, [activeWorkspace?.id, queryClient]);

  // ── No workspace: prompt to create one ───────────────────────────────────
  if (!activeWorkspace) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-6 text-center border border-border-subtle p-8 rounded-[--radius-lg] bg-card">
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Create a workspace
            </h2>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              You need a workspace to start using LeadForge OS.
            </p>
          </div>
          <CreateWorkspaceForm />
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
        <AppSidebar activeWorkspace={activeWorkspace} />

        <SidebarInset className="flex flex-col min-w-0">
          <AppHeader />
          <main className="flex-1 overflow-y-auto p-4 max-h-[calc(100vh-44px)]">
            <Suspense fallback={<AppContentSkeleton />}>
              <Outlet />
            </Suspense>
          </main>
        </SidebarInset>
      </div>
      <ProductTour />
    </SidebarProvider>
  );
}

/** Skeleton shown while lazy-loaded screen chunks are loading. */
function AppContentSkeleton() {
  return (
    <div className="space-y-4 p-2">
      <Skeleton className="h-6 w-1/3" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Skeleton className="h-20 rounded-[--radius-lg]" />
        <Skeleton className="h-20 rounded-[--radius-lg]" />
        <Skeleton className="h-20 rounded-[--radius-lg]" />
        <Skeleton className="h-20 rounded-[--radius-lg]" />
      </div>
      <Skeleton className="h-64 rounded-[--radius-lg]" />
    </div>
  );
}
