import { cn } from '@/shared/utils/cn';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

/**
 * PageHeader — reusable top-of-page header for all screens.
 *
 * Typography per DESIGN.md §3:
 *   - Title: heading-sm (16px/24px, 600, -0.01em tracking)
 *   - Description: body-sm (13px/20px, 400)
 *
 * Layout: title+description left, actions right — separated by a bottom border.
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-end justify-between border-b border-border-subtle pb-3',
        className
      )}
    >
      <div className="space-y-0.5 min-w-0">
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-foreground leading-6 truncate">
          {title}
        </h2>
        {description && (
          <p className="text-[12px] text-muted-foreground leading-5">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 ml-4">{actions}</div>
      )}
    </div>
  );
}
