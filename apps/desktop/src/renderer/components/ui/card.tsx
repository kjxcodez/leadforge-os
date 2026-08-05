import * as React from 'react';

import { cn } from '@/shared/utils/cn';

/**
 * Card — DESIGN.md §5 Cards
 *
 * Spec:
 *   - Background: surface-1 (bg-card)
 *   - Border: border-subtle (1px hairline)
 *   - Radius: radius-lg (12px)
 *   - Internal padding: 24px
 *   - Interactive hover (only if card is clickable): border-default bg, surface-2 bg
 *   - No lift/scale transform, no shadow pop (DESIGN.md §7)
 *   - Elevation-0 by default (no shadow)
 */
function Card({
  className,
  size = 'default',
  interactive = false,
  ...props
}: React.ComponentProps<'div'> & {
  size?: 'default' | 'sm';
  /** Set true to add hover border/bg treatment for clickable cards. */
  interactive?: boolean;
}) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        'flex flex-col gap-[--card-spacing] overflow-hidden',
        'rounded-[--radius-lg] border border-border-subtle bg-card',
        'text-sm text-card-foreground',
        '[--card-spacing:theme(spacing.6)]',          /* 24px per DESIGN.md */
        'data-[size=sm]:[--card-spacing:theme(spacing.4)]', /* 16px compact */
        // Optional hover treatment for interactive/clickable cards
        interactive && [
          'transition-colors duration-[--duration-instant]',
          'hover:border-border-default hover:bg-popover',
          'cursor-pointer'
        ],
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        'grid auto-rows-min items-start gap-1.5 px-[--card-spacing]',
        'has-data-[slot=card-action]:grid-cols-[1fr_auto]',
        '[.border-b]:pb-[--card-spacing]',
        className
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        'text-base font-semibold leading-snug tracking-[-0.01em]',
        'group-data-[size=sm]/card:text-sm',
        className
      )}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-description"
      className={cn('text-sm text-muted-foreground leading-relaxed', className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-content"
      className={cn('px-[--card-spacing]', className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        'flex items-center border-t border-border-subtle bg-muted/30 p-[--card-spacing]',
        className
      )}
      {...props}
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
