import { cn } from '@/shared/utils/cn';

type StatusVariant = 'running' | 'stopped' | 'warning' | 'idle';

interface StatusDotProps {
  variant: StatusVariant;
  /** Shows a pulse animation when running */
  pulse?: boolean;
  className?: string;
}

const variantClasses: Record<StatusVariant, string> = {
  running: 'bg-success',
  stopped: 'bg-danger',
  warning: 'bg-warning',
  idle:    'bg-border-strong'
};

/**
 * StatusDot — a small circular status indicator.
 *
 * Uses semantic design tokens (success/danger/warning) — never hardcoded colors.
 * Running state can optionally pulse (DESIGN.md §7: spinners only for
 * indeterminate short operations).
 */
export function StatusDot({ variant, pulse = false, className }: StatusDotProps) {
  return (
    <span
      className={cn(
        'inline-block w-2 h-2 rounded-full shrink-0',
        variantClasses[variant],
        pulse && variant === 'running' && 'animate-pulse',
        className
      )}
      aria-hidden="true"
    />
  );
}
