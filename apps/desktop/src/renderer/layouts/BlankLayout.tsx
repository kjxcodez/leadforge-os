import type { ReactNode } from 'react';

/**
 * BlankLayout renders children on a full-screen dark surface.
 * Used for splash screens, session-expired, and other chrome-free views.
 */
export function BlankLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground">
      {children}
    </div>
  );
}
