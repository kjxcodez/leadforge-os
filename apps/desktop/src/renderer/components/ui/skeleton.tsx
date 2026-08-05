import { cn } from '@/shared/utils/cn';

/**
 * Skeleton — DESIGN.md §7 Loading States
 *
 * Uses surface-2 (popover) as the skeleton background — one step above
 * the resting surface, creating visible contrast without harsh color shifts.
 * Prefer skeleton screens over spinners whenever layout is known in advance.
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'animate-pulse rounded-[--radius-md] bg-popover',
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
