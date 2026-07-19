import { useEffect, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { AnimatedBackground } from '../components/auth/animated-bg';
import { BrandPanel } from '../components/auth/brand-panel';

/**
 * AuthLayout provides the split-screen shell for all authentication pages.
 * Left column: brand mark + form content (via <Outlet />).
 * Right column: ambient animated graphic (hidden on small screens).
 */
export function AuthLayout() {
  useEffect(() => {
    window.ipc.invoke('electron:ready-to-show' as any).catch(() => {});
  }, []);

  return (
    <div className="grid h-screen w-screen grid-cols-1 bg-neutral-950 md:grid-cols-2 select-none">
      <div className="relative flex flex-col overflow-hidden">
        <BrandPanel className="p-8" />
        <div className="flex flex-1 items-center justify-center px-8 pb-8">
          <div className="w-full max-w-sm">
            <Suspense fallback={<div className="text-center text-xs text-muted-foreground animate-pulse">Loading auth screen...</div>}>
              <Outlet />
            </Suspense>
          </div>
        </div>
      </div>

      <div className="relative hidden md:block">
        <AnimatedBackground />
      </div>
    </div>
  );
}
