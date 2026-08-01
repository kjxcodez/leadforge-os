import { Hexagon } from 'lucide-react';

interface BrandPanelProps {
  className?: string;
}

/** Logo + product wordmark shown at the top of the authentication layout. */
export function BrandPanel({ className }: BrandPanelProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ''}`}>
      <Hexagon className="h-5 w-5 text-neutral-300" strokeWidth={1.75} aria-hidden="true" />
      <span className="text-sm font-medium tracking-tight text-neutral-200">LeadForge OS</span>
    </div>
  );
}
