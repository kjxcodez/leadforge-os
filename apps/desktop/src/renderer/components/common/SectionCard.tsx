import { cn } from '@/shared/utils/cn';
import type { ReactNode } from 'react';

interface SectionCardProps {
  children: ReactNode;
  className?: string;
  /** Compact mode: 16px padding instead of default 20px */
  compact?: boolean;
}

/**
 * SectionCard — the standard panel container used across all screens.
 *
 * Encapsulates the bg-card, border-border-subtle, rounded-[--radius-lg], p-5
 * pattern pervasive in DashboardScreen, OperationsCenterScreen, etc.
 *
 * Per DESIGN.md §5 Cards:
 *   - Background: surface-1 (bg-card)
 *   - Border: border-subtle hairline
 *   - Radius: radius-lg (12px)
 *   - No decorative shadow
 */
export function SectionCard({ children, className, compact = false }: SectionCardProps) {
  return (
    <div
      className={cn(
        'bg-card border border-border-subtle rounded-[--radius-lg]',
        compact ? 'p-4' : 'p-5',
        className
      )}
    >
      {children}
    </div>
  );
}
