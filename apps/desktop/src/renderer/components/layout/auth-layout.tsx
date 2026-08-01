import type { ReactNode } from 'react';
import { BrandPanel } from '../auth/brand-panel';
import { ContentPanel } from '../auth/content-panel';
import { AnimatedBackground } from '../auth/animated-bg';

interface AuthenticationLayoutProps {
  children?: ReactNode;
}

/**
 * Shared split-screen shell for all authentication pages.
 * Left: brand mark + form content. Right: ambient animated graphic.
 */
export function AuthenticationLayout({ children }: AuthenticationLayoutProps) {
  return (
    <div className="grid h-screen w-screen grid-cols-1 bg-neutral-950 md:grid-cols-2">
      <div className="relative flex flex-col">
        <BrandPanel className="p-8" />
        <div className="flex flex-1 items-center justify-center">
          <ContentPanel>{children}</ContentPanel>
        </div>
      </div>

      <div className="relative hidden md:block">
        <AnimatedBackground />
      </div>
    </div>
  );
}
