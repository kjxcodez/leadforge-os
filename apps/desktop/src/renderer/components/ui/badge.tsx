import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/shared/utils/cn';

/**
 * Badge — DESIGN.md §5 Badges / Tags
 *
 * Spec:
 *   - radius-sm (4px)
 *   - caption type: 12px, 500 weight, +0.04em tracking, uppercase optional
 *   - 4px vertical / 8px horizontal padding
 *   - Neutral (default): surface-3 bg, border-subtle, secondary text
 *   - Status variants use -muted semantic backgrounds with full-strength text
 */
const badgeVariants = cva(
  [
    'group/badge inline-flex w-fit shrink-0 items-center gap-1',
    'rounded-[--radius-sm] border px-2 py-[3px]',
    'text-[11px] font-medium tracking-[0.04em] whitespace-nowrap',
    'transition-colors duration-[--duration-instant]',
    'focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
    "[&>svg]:pointer-events-none [&>svg]:size-3!"
  ].join(' '),
  {
    variants: {
      variant: {
        /** Neutral — default surface treatment. */
        default:
          'bg-surface-3 border-border-subtle text-muted-foreground',

        /** On-primary — used for counts inside accent-colored contexts. */
        primary:
          'bg-primary text-primary-foreground border-transparent',

        /** Secondary surface. */
        secondary:
          'bg-secondary border-border-subtle text-secondary-foreground',

        /** Success state — muted green fill, full green text. */
        success:
          'bg-success-muted border-success/20 text-success',

        /** Warning state — muted amber fill, full amber text. */
        warning:
          'bg-warning-muted border-warning/20 text-warning',

        /** Danger/error state — muted red fill, full red text. */
        danger:
          'bg-danger-muted border-danger/20 text-danger',

        /** Destructive (alias for danger — backward compat). */
        destructive:
          'bg-danger-muted border-danger/20 text-danger',

        /** Info state — muted blue fill, full blue text. */
        info:
          'bg-info-muted border-info/20 text-info',

        /** Outline — minimal treatment: border only. */
        outline:
          'border-border-default bg-transparent text-foreground',

        /** Ghost — no border. */
        ghost:
          'border-transparent bg-transparent text-muted-foreground hover:bg-surface-3'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
);

function Badge({
  className,
  variant = 'default',
  render,
  ...props
}: useRender.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: 'span',
    props: mergeProps<'span'>(
      {
        className: cn(badgeVariants({ variant }), className)
      },
      props
    ),
    render,
    state: {
      slot: 'badge',
      variant
    }
  });
}

export { Badge, badgeVariants };
