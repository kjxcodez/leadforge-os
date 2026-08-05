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
      <div className="relative flex flex-col overflow-hidden">
        <BrandPanel className="p-8" />
        <div className="flex flex-1 items-center justify-center px-8 pb-8 relative">
          {/* Subtle background pulsing glows behind the glassmorphic card */}
          <div className="absolute top-[10%] left-[10%] w-[180px] h-[180px] bg-primary/30 rounded-full filter blur-[60px] pointer-events-none z-10" />
          <div className="absolute bottom-[10%] right-[10%] w-[160px] h-[160px] bg-info/20 rounded-full filter blur-[50px] pointer-events-none z-10" />

          <div className="w-full max-w-md bg-card/45 backdrop-blur-xl border border-border-subtle/60 rounded-none p-10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] relative overflow-hidden z-50">
            {/* Top-left decorative dots */}
            <svg
              className="absolute top-3 left-3 opacity-25 text-primary w-10 h-10"
              fill="currentColor"
              viewBox="0 0 100 100"
            >
              {[...Array(4)].map((_, r) =>
                [...Array(4)].map((_, c) => (
                  <circle key={`${r}-${c}`} cx={15 + c * 23} cy={15 + r * 23} r="3" />
                ))
              )}
            </svg>

            {/* Bottom-right decorative dots */}
            <svg
              className="absolute bottom-3 right-3 opacity-25 text-info w-10 h-10"
              fill="currentColor"
              viewBox="0 0 100 100"
            >
              {[...Array(4)].map((_, r) =>
                [...Array(4)].map((_, c) => (
                  <circle key={`${r}-${c}`} cx={15 + c * 23} cy={15 + r * 23} r="3" />
                ))
              )}
            </svg>

            <Suspense
              fallback={
                <div className="space-y-4">
                  <Skeleton className="h-8 w-3/4 rounded-none" />
                  <Skeleton className="h-9 w-full rounded-none" />
                  <Skeleton className="h-9 w-full rounded-none" />
                  <Skeleton className="h-9 w-full rounded-none" />
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
