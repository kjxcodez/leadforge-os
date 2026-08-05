import { SectionCard } from '../common/SectionCard';
import { Skeleton } from '../ui/skeleton';
import { CheckCircle2, RefreshCw, AlertTriangle, MessageSquare, Flame } from 'lucide-react';

interface WorkflowStats {
  waitingCount: number;
  runningCount: number;
  repliedCount: number;
  failedCount: number;
  pausedCount: number;
  completedCount: number;
  totalJobs: number;
  queueSize: number;
}

interface WorkflowAnalyticsProps {
  stats: WorkflowStats | undefined;
  isLoading: boolean;
}

/**
 * WorkflowAnalytics — campaign conversion funnel and execution health.
 *
 * Visualizes sequence execution statuses: Completed, Active, and Replies.
 * Includes a premium circular gauge tracking the Reply Rate (primary sales metric).
 */
export function WorkflowAnalytics({ stats, isLoading }: WorkflowAnalyticsProps) {
  // Calculate total executions in the system
  const totalExecutions = stats
    ? stats.completedCount +
      stats.runningCount +
      stats.waitingCount +
      stats.failedCount +
      stats.pausedCount +
      stats.repliedCount
    : 0;

  // Conversion reply rate
  const replyRate = totalExecutions > 0 && stats
    ? Math.round((stats.repliedCount / totalExecutions) * 100)
    : 0;

  // Gauge geometry (r=30, circumference = 188.4)
  const radius = 30;
  const strokeWidth = 5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (replyRate / 100) * circumference;

  const rows = [
    { label: 'Completed', value: stats?.completedCount ?? 0, color: 'text-success', icon: CheckCircle2, bg: 'bg-success/10' },
    { label: 'Active Running', value: stats?.runningCount ?? 0, color: 'text-info', icon: RefreshCw, bg: 'bg-info/10', spin: true },
    { label: 'Replies', value: stats?.repliedCount ?? 0, color: 'text-primary', icon: MessageSquare, bg: 'bg-primary/10' },
    { label: 'Failures', value: stats?.failedCount ?? 0, color: 'text-danger', icon: AlertTriangle, bg: 'bg-danger/10' }
  ];

  return (
    <SectionCard compact className="flex flex-col h-[210px] justify-between">
      {/* Header */}
      <div className="border-b border-border-subtle pb-2 mb-2 flex justify-between items-center shrink-0">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-foreground">
          Sequence Health
        </h3>
        <span className="text-[10px] text-muted-foreground font-mono">Conversion stats</span>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center gap-6">
          <Skeleton className="size-16 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center gap-4 min-h-0">
          {/* Circular reply rate gauge */}
          <div className="flex flex-col items-center gap-1.5 shrink-0 select-none">
            <div className="relative size-16 flex items-center justify-center">
              <svg className="size-full -rotate-90">
                {/* Background track */}
                <circle
                  cx="32"
                  cy="32"
                  r={radius}
                  fill="transparent"
                  stroke="var(--border-subtle)"
                  strokeWidth={strokeWidth}
                />
                {/* Active progress */}
                <circle
                  cx="32"
                  cy="32"
                  r={radius}
                  fill="transparent"
                  stroke="var(--primary)"
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-[stroke-dashoffset] duration-500 ease-out"
                />
              </svg>
              {/* Telemetry reading inside ring */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-bold text-foreground font-mono leading-none">
                  {replyRate}%
                </span>
              </div>
            </div>
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-0.5">
              <Flame className="size-2.5 text-primary" /> Reply Rate
            </span>
          </div>

          {/* Key Metric Rows */}
          <div className="flex-1 grid grid-cols-2 gap-2 text-[11px]">
            {rows.map((row) => (
              <div
                key={row.label}
                className="bg-surface-3 border border-border-subtle rounded-[--radius-md] p-2 flex items-center gap-2"
              >
                <div className={`p-1 rounded-[--radius-sm] ${row.bg} ${row.color} shrink-0`}>
                  <row.icon className={`size-3 ${row.spin && row.value > 0 ? 'animate-spin' : ''}`} />
                </div>
                <div className="min-w-0">
                  <span className="block text-[9px] text-muted-foreground truncate leading-tight font-medium">
                    {row.label}
                  </span>
                  <span className="font-semibold text-foreground font-mono leading-none tabular-nums">
                    {row.value.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
