import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Download,
  Calendar,
  Clock,
  RefreshCw,
  Send,
  Eye,
  MousePointer,
  MessageSquare,
  AlertOctagon,
  ShieldCheck,
  Zap,
  Info
} from 'lucide-react';
import { Button } from '../ui/button';
import { MetricExplainableCard } from './MetricExplainableCard';
import { CampaignFunnelCard } from './CampaignFunnelCard';
import { SequenceStepTable } from './SequenceStepTable';
import { CampaignTimelineChart } from './CampaignTimelineChart';
import { MailboxBreakdownCard } from './MailboxBreakdownCard';
import { AudienceQualityCard } from './AudienceQualityCard';
import { toast } from 'sonner';

interface CampaignAnalyticsViewProps {
  workspaceId: string;
  campaignId: string;
}

type TimeRangePreset = '7d' | '14d' | '30d' | 'all';

export function CampaignAnalyticsView({ workspaceId, campaignId }: CampaignAnalyticsViewProps) {
  const [timeRange, setTimeRange] = useState<TimeRangePreset>('all');
  const [isExporting, setIsExporting] = useState(false);

  // Compute start date from preset
  const getStartDate = (preset: TimeRangePreset): string | undefined => {
    if (preset === 'all') return undefined;
    const now = new Date();
    const days = preset === '7d' ? 7 : preset === '14d' ? 14 : 30;
    const d = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return d.toISOString();
  };

  const queryParams = {
    startDate: getStartDate(timeRange)
  };

  // 1. Overview Query
  const {
    data: overview,
    isLoading: overviewLoading,
    refetch: refetchOverview,
    isRefetching
  } = useQuery({
    queryKey: ['analytics', 'overview', workspaceId, campaignId, timeRange],
    queryFn: async () => {
      return (window as any).ipc.invoke('analytics:campaign:overview', {
        workspaceId,
        campaignId,
        query: queryParams
      });
    }
  });

  // 2. Timeline Query
  const { data: timelineData, isLoading: timelineLoading } = useQuery({
    queryKey: ['analytics', 'timeline', workspaceId, campaignId, timeRange],
    queryFn: async () => {
      return (window as any).ipc.invoke('analytics:campaign:timeline', {
        workspaceId,
        campaignId,
        query: queryParams
      });
    }
  });

  // 3. Steps Query
  const { data: stepsData, isLoading: stepsLoading } = useQuery({
    queryKey: ['analytics', 'steps', workspaceId, campaignId],
    queryFn: async () => {
      return (window as any).ipc.invoke('analytics:campaign:steps', {
        workspaceId,
        campaignId
      });
    }
  });

  // 4. Mailboxes Query
  const { data: mailboxesData, isLoading: mailboxesLoading } = useQuery({
    queryKey: ['analytics', 'mailboxes', workspaceId, campaignId],
    queryFn: async () => {
      return (window as any).ipc.invoke('analytics:campaign:mailboxes', {
        workspaceId,
        campaignId
      });
    }
  });

  // 5. Quality Query
  const { data: qualityData, isLoading: qualityLoading } = useQuery({
    queryKey: ['analytics', 'quality', workspaceId, campaignId],
    queryFn: async () => {
      return (window as any).ipc.invoke('analytics:campaign:quality', {
        workspaceId,
        campaignId
      });
    }
  });

  // CSV Export Handler
  const handleExport = async (format: 'csv' | 'json' = 'csv') => {
    try {
      setIsExporting(true);
      const res = await (window as any).ipc.invoke('analytics:campaign:export', {
        workspaceId,
        campaignId,
        format,
        query: queryParams
      });

      if (format === 'csv' && res.csvContent) {
        const blob = new Blob([res.csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `campaign_${campaignId}_analytics.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Analytics exported to CSV successfully');
      } else {
        const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `campaign_${campaignId}_analytics.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Analytics exported to JSON successfully');
      }
    } catch (err: any) {
      toast.error(`Export failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const isLoading = overviewLoading || timelineLoading || stepsLoading || mailboxesLoading || qualityLoading;

  if (isLoading && !overview) {
    return (
      <div className="bg-card border border-border-subtle rounded-none p-12 text-center space-y-3">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary" />
        <p className="text-xs text-muted-foreground font-mono">
          Aggregating campaign performance telemetry...
        </p>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="bg-card border border-border-subtle rounded-none p-12 text-center text-muted-foreground text-xs italic">
        No performance records found for this campaign.
      </div>
    );
  }

  return (
    <div className="space-y-4 select-none">
      {/* Analytics Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border-subtle rounded-none p-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mr-1">
            Time Range:
          </span>
          {(['7d', '14d', '30d', 'all'] as TimeRangePreset[]).map((preset) => (
            <Button
              key={preset}
              type="button"
              variant={timeRange === preset ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange(preset)}
              className="h-6 text-[10px] px-2.5 rounded-none font-mono"
            >
              {preset.toUpperCase()}
            </Button>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => refetchOverview()}
            className="h-6 text-[10px] px-1.5 rounded-none text-muted-foreground hover:text-foreground"
            title="Refresh metrics"
          >
            <RefreshCw className={`w-3 h-3 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-zinc-400">
            Timezone: <strong className="text-foreground">{overview.timezone}</strong>
          </span>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleExport('csv')}
              disabled={isExporting}
              className="h-6 text-[10px] px-2.5 rounded-none gap-1 font-mono"
            >
              <Download className="w-3 h-3" />
              Export CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleExport('json')}
              disabled={isExporting}
              className="h-6 text-[10px] px-2 rounded-none font-mono"
            >
              JSON
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Explainable Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricExplainableCard
          title="Provider Acceptance"
          metric={overview.rates.providerAcceptanceRate}
          icon={<Send className="w-3.5 h-3.5 text-info" />}
          variant="info"
          benchmark=">98%"
        />

        <MetricExplainableCard
          title="Observed Opens"
          metric={overview.rates.observedOpenRate}
          icon={<Eye className="w-3.5 h-3.5 text-warning" />}
          variant="warning"
        />

        <MetricExplainableCard
          title="Unique Open Rate"
          metric={overview.rates.uniqueOpenRate}
          icon={<Eye className="w-3.5 h-3.5 text-warning" />}
          variant="default"
          benchmark=">40%"
        />

        <MetricExplainableCard
          title="Contact Reply Rate"
          metric={overview.rates.contactReplyRate}
          icon={<MessageSquare className="w-3.5 h-3.5 text-success" />}
          variant="success"
          benchmark=">5%"
        />

        <MetricExplainableCard
          title="Hard Bounce Rate"
          metric={overview.rates.hardBounceRate}
          icon={<AlertOctagon className="w-3.5 h-3.5 text-danger" />}
          variant="danger"
          benchmark="<2%"
        />

        {/* Median Latency KPI */}
        <div className="bg-card border border-border-subtle rounded-none p-3.5 flex flex-col justify-between shadow-sm hover:border-primary/40 transition-colors">
          <div>
            <div className="flex items-center justify-between text-muted-foreground mb-1.5">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary opacity-80" />
                <span className="text-[11px] font-medium text-foreground tracking-tight">
                  Median Reply
                </span>
              </div>
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-bold font-mono tracking-tight text-foreground">
                {overview.latency.medianHours}h
              </span>
              <span className="text-[9px] text-muted-foreground font-mono">
                (p90: {overview.latency.p90Hours}h)
              </span>
            </div>
          </div>
          <p className="text-[9px] text-muted-foreground italic mt-2 border-t border-border-subtle/40 pt-1.5 leading-tight">
            {overview.latency.sampleSizeNote}
          </p>
        </div>
      </div>

      {/* Funnel + Attribution Row */}
      <CampaignFunnelCard
        stages={overview.funnel}
        attributionConfidence={overview.attributionConfidence}
      />

      {/* Daily Telemetry Timeline Chart */}
      <CampaignTimelineChart
        points={timelineData?.points || []}
        timezone={timelineData?.timezone || overview.timezone}
      />

      {/* Sequence Step Conversion Table */}
      <SequenceStepTable steps={stepsData?.steps || []} />

      {/* Grid: Sender Mailbox Health + Audience Quality Correlation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MailboxBreakdownCard mailboxes={mailboxesData?.mailboxes || []} />
        <AudienceQualityCard breakdown={qualityData || { totalEnrolled: 0, segments: [] }} />
      </div>
    </div>
  );
}
