import { TimelineView } from '../crm/TimelineView';
import { Skeleton } from '../ui/skeleton';
import { SectionCard } from '../common/SectionCard';

interface ActivityFeedProps {
  events: any[];
  isLoading: boolean;
}

/**
 * ActivityFeed — the live activity log column on the dashboard.
 * Wraps TimelineView with consistent card chrome and skeleton states.
 */
export function ActivityFeed({ events, isLoading }: ActivityFeedProps) {
  return (
    <SectionCard compact className="flex flex-col h-[290px]">
      {/* Header */}
      <div className="border-b border-border-subtle pb-2 mb-3 flex justify-between items-center shrink-0">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-foreground">
          Recent Activity
        </h3>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
          </span>
          <span className="text-[10px] text-muted-foreground font-mono select-none">Live Logs</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-3 py-1">
            <Skeleton className="h-9 w-full rounded-[--radius-md]" />
            <Skeleton className="h-9 w-full rounded-[--radius-md]" />
            <Skeleton className="h-9 w-full rounded-[--radius-md]" />
          </div>
        ) : (
          <TimelineView events={events} isLoading={false} />
        )}
      </div>
    </SectionCard>
  );
}
