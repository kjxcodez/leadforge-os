import * as React from 'react';
import { Input as InputPrimitive } from '@base-ui/react/input';

import { cn } from '@/shared/utils/cn';

/**
 * Input — DESIGN.md §5 Inputs
 *
 * Spec:
 *   - Background: surface-1 (bg-card)
 *   - Border: border-default at rest
 *   - Focus: border becomes primary (accent orange) + 2px ring
 *   - Placeholder: text-tertiary
 *   - Error: border-danger + ring-danger/20 (via aria-invalid)
 *   - Height: 36px (h-9) single-line
 *   - Font: body-md (15px / 24px)
 *   - Radius: radius-md (8px)
 */
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        /* Base structure */
        'h-9 w-full min-w-0 rounded-[--radius-md]',
        'border border-border-default bg-card',
        'px-3 py-2',
        'text-[15px] leading-6 text-foreground',
        'placeholder:text-text-tertiary',

        /* File input */
        'file:inline-flex file:h-6 file:border-0 file:bg-transparent',
        'file:text-sm file:font-medium file:text-foreground',

        /* Transitions — instant per DESIGN.md §7 */
        'transition-colors duration-[--duration-instant]',
        'outline-none',

        /* Focus: accent orange border + ring */
        'focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25',

        /* Disabled */
        'disabled:pointer-events-none disabled:cursor-not-allowed',
        'disabled:bg-muted disabled:opacity-50',

        /* Error state (aria-invalid) */
        'aria-invalid:border-danger aria-invalid:ring-2 aria-invalid:ring-danger/20',

        className
      )}
      {...props}
    />
  );
}

export { Input };
