import logoLight from '../../assets/app-icon-light.png';

interface BrandPanelProps {
  className?: string;
}

/**
 * Logo + product wordmark shown at the top of the authentication layout.
 * Uses theme tokens — renders correctly in both light and dark mode.
 */
export function BrandPanel({ className }: BrandPanelProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ''}`}>
      {/* Geometric logo mark — diagonal cut language per DESIGN.md §6 */}
      <img src={logoLight} className="h-6 w-6 object-contain rounded" alt="LeadForge Logo" />
      <span className="text-sm font-semibold tracking-tight text-foreground">LeadForge OS</span>
    </div>
  );
}
