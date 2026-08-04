import { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { SectionCard } from '../common/SectionCard';
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '../ui/chart';

interface DayData {
  day: string;
  emailsSent?: number;
  contactsCreated?: number;
  executions?: number;
}

interface OutreachChartProps {
  data: DayData[];
  isLoading: boolean;
  range: number;
  onRangeChange: (range: number) => void;
}

const TIME_RANGES = [
  { label: '7D',  val: 7 },
  { label: '30D', val: 30 },
  { label: '90D', val: 90 }
] as const;

const chartConfig = {
  executions: {
    label: 'Workflows',
    color: 'var(--primary)'
  },
  emailsSent: {
    label: 'Emails',
    color: 'var(--info)'
  },
  contactsCreated: {
    label: 'Contacts',
    color: 'var(--success)'
  }
};

/**
 * OutreachChart — stacked bar chart showing email/contact/execution activity.
 *
 * Rewritten using Recharts and ChartContainer for a premium, theme-aware,
 * interactive visualization with smooth animations and custom tooltips.
 */
export function OutreachChart({ data, isLoading, range, onRangeChange }: OutreachChartProps) {
  // Format dates for X-Axis (e.g. "2026-08-04" -> "Aug 04")
  const formattedData = data.map((d) => {
    let dateLabel = d.day;
    try {
      const parts = d.day.split('-');
      if (parts.length === 3) {
        const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        dateLabel = date.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
      }
    } catch {
      // Fallback to raw string
    }
    return {
      ...d,
      dateLabel
    };
  });

  return (
    <SectionCard compact className="flex flex-col h-[210px] justify-between">
      {/* Header row */}
      <div className="flex justify-between items-center border-b border-border-subtle pb-2 mb-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-foreground">
            Outreach Activity
          </h3>
        </div>

        {/* Timeframe selector */}
        <div className="flex bg-surface-3 border border-border-subtle p-0.5 rounded-[--radius-sm] gap-0.5">
          {TIME_RANGES.map((t) => (
            <button
              key={t.val}
              onClick={() => onRangeChange(t.val)}
              className={[
                'px-2 py-0.5 rounded-[--radius-sm] text-[11px] font-medium transition-colors duration-[--duration-instant] cursor-pointer',
                range === t.val
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart body */}
      {isLoading ? (
        <Skeleton className="flex-1 w-full rounded-none" />
      ) : data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center border border-dashed border-border-subtle rounded-none bg-surface-3/50">
          <span className="text-muted-foreground text-[12px]">
            No activity logs found for this period.
          </span>
        </div>
      ) : (
        <div className="flex-1 w-full min-h-0 select-none">
          <ChartContainer config={chartConfig} className="h-full w-full aspect-auto">
            <BarChart
              data={formattedData}
              margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border-subtle" />
              <XAxis
                dataKey="dateLabel"
                stroke="var(--text-tertiary)"
                fontSize={9}
                tickLine={false}
                axisLine={false}
                dy={8}
              />
              <YAxis
                stroke="var(--text-tertiary)"
                fontSize={9}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                content={<ChartTooltipContent />}
                cursor={{ fill: 'var(--surface-3)', opacity: 0.15 }}
              />
              <Bar dataKey="executions" stackId="outreach" fill="var(--primary)" radius={[0, 0, 0, 0]} isAnimationActive animationDuration={700} animationEasing="ease-out" />
              <Bar dataKey="emailsSent" stackId="outreach" fill="var(--info)" radius={[0, 0, 0, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out" />
              <Bar dataKey="contactsCreated" stackId="outreach" fill="var(--success)" radius={[2, 2, 0, 0]} isAnimationActive animationDuration={900} animationEasing="ease-out" />
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </SectionCard>
  );
}
