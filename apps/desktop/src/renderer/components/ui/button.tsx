import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/shared/utils/cn';

/**
 * Button — DESIGN.md §5 Buttons
 *
 * Variant mapping:
 *   default     → Primary CTA: Forge Orange fill, dark text. One per view region.
 *   secondary   → Standard actions: surface-2 bg, default border.
 *   ghost       → Tertiary / toolbar icons: transparent, muted text.
 *   destructive → Delete / revoke: danger text + border at rest; fill on confirm.
 *   outline     → Legacy alias for secondary — prefer `secondary`.
 *   link        → In-text navigation only.
 *
 * Height scale (DESIGN.md §5):
 *   default → 36px  (standard UI)
 *   sm      → 32px  (compact / toolbar)
 *   lg      → 44px  (marketing CTA only — never inside the desktop shell)
 *
 * Padding: 16px horizontal minimum regardless of size.
 * Focus ring: 2px Forge Orange, 2px offset (DESIGN.md §2 Accessibility).
 * No scale/transform hovers (DESIGN.md §7 — hover is a light switch, not movement).
 */
const buttonVariants = cva(
  [
    'group/button inline-flex shrink-0 items-center justify-center gap-1.5',
    'rounded-[--radius-md] border border-transparent bg-clip-padding',
    'text-sm font-medium whitespace-nowrap select-none',
    'transition-colors duration-[--duration-instant]',
    'outline-none',
    'focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    'aria-invalid:border-destructive aria-invalid:outline-destructive/30',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
    "[&_svg:not([class*='size-'])]:size-4",
    'cursor-pointer'
  ].join(' '),
  {
    variants: {
      variant: {
        /** Forge Orange fill — one per view region. */
        default:
          'bg-primary text-primary-foreground hover:bg-primary/85 active:bg-primary/75',

        /** Surface-2 background with default border — standard secondary action. */
        secondary:
          'bg-secondary text-secondary-foreground border-border-default hover:bg-popover hover:border-border-strong',

        /** Alias for secondary (backward compat). */
        outline:
          'bg-secondary text-secondary-foreground border-border-default hover:bg-popover hover:border-border-strong',

        /** Transparent, muted text — toolbar and tertiary actions. */
        ghost:
          'text-muted-foreground hover:bg-surface-3 hover:text-foreground',

        /**
         * Danger: transparent at rest (danger text + border).
         * Caller is responsible for adding a confirmation step before destructive action.
         */
        destructive:
          'border-danger/35 text-danger hover:bg-danger-muted focus-visible:outline-danger/30',

        /** In-body text links only. */
        link: 'text-primary underline-offset-4 hover:underline'
      },
      size: {
        /** 36px — standard desktop UI height. */
        default: 'h-9 px-4 text-sm',

        /** 32px — compact / toolbar contexts. */
        sm:      'h-8 px-4 text-xs rounded-[--radius-md]',

        /** 44px — marketing site CTA only. Never inside the desktop shell. */
        lg:      'h-11 px-6 text-sm',

        /** 36px icon-only square. */
        icon:    'size-9',

        /** 32px icon-only — compact toolbar. */
        'icon-sm': 'size-8 rounded-[--radius-md]',

        /** Micro size for tag/badge contexts. */
        xs:      'h-6 px-3 text-xs rounded-[--radius-sm]',

        /** Micro icon-only square — alias for xs icon contexts (e.g. chip remove). */
        'icon-xs': 'size-6 rounded-[--radius-sm]'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
