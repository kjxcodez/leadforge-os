import { useEffect, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { AnimatedBackground } from '../components/auth/animated-bg';
import { BrandPanel } from '../components/auth/brand-panel';
import { Skeleton } from '../components/ui/skeleton';

/**
 * AuthLayout provides the split-screen shell for all authentication pages.
 * Left column: brand mark + form content (via <Outlet />).
 * Right column: ambient animated graphic (hidden on small screens).
 *
 * Uses bg-background (theme-aware) — dark in dark mode, light in light mode.
 */
export function AuthLayout() {
  useEffect(() => {
    window.ipc.invoke('electron:ready-to-show' as any, null).catch(() => {});
  }, []);

  return (
    <div className="grid h-screen w-screen grid-cols-1 bg-background md:grid-cols-2 select-none">
      {/* Form column */}
      <div className="relative flex flex-col overflow-hidden z-10">
        <BrandPanel className="p-8" />
        <div className="flex flex-1 items-center justify-center px-8 pb-8">
          <div className="w-full max-w-sm">
            <Suspense
              fallback={
                <div className="space-y-4">
                  <Skeleton className="h-8 w-3/4" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Ambient right panel — hidden on small screens */}
      <div className="hidden md:block">
        <AnimatedBackground />
      </div>
    </div>
  );
}
