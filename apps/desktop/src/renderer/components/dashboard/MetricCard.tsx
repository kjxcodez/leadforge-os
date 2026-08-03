import { Skeleton } from '../ui/skeleton';
import { SectionCard } from '../common/SectionCard';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: number;
  Icon: LucideIcon;
  /** Tailwind text color class for the icon — must use design tokens */
  iconClass?: string;
  isLoading: boolean;
}

/**
 * MetricCard — a single KPI card in the dashboard metrics grid.
 *
 * Per DESIGN.md §5 Cards: surface-1 background, border-subtle, radius-lg.
 * No hover effects (card is not interactive).
 * Loading state uses Skeleton per §7.
 */
export function MetricCard({ label, value, Icon, iconClass, isLoading }: MetricCardProps) {
  return (
    <SectionCard compact className="flex items-center justify-between gap-3">
      <div className="space-y-1.5 flex-1 min-w-0">
        <span className="block text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground truncate">
          {label}
        </span>
        {isLoading ? (
          <Skeleton className="h-6 w-16" />
        ) : (
          <div className="text-xl font-semibold text-foreground leading-none tabular-nums">
            {value.toLocaleString()}
          </div>
        )}
      </div>

      {/* Icon cell — surface-1 card border so it sits at the same elevation */}
      <div
        className={[
          'w-8 h-8 rounded-[--radius-md] bg-card border border-border-subtle',
          'flex items-center justify-center shrink-0',
          iconClass ?? 'text-primary'
        ].join(' ')}
        aria-hidden="true"
      >
        <Icon className="w-4 h-4" />
      </div>
    </SectionCard>
  );
}
