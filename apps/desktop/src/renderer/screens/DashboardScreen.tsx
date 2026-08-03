import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '../hooks/useWorkspace';
import { Building2, Users, Megaphone, Zap, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { PageHeader } from '../components/common/PageHeader';
import { MetricCard } from '../components/dashboard/MetricCard';
import { OutreachChart } from '../components/dashboard/OutreachChart';
import { ActivityFeed } from '../components/dashboard/ActivityFeed';
import { InfraStatusPanel } from '../components/dashboard/InfraStatusPanel';
import { WorkflowAnalytics } from '../components/dashboard/WorkflowAnalytics';
import { toast } from 'sonner';

/**
 * DashboardScreen — workspace-wide aggregate metrics view.
 *
 * Responsibility: fetch data, manage query state, compose display components.
 * Visual logic lives in sub-components under components/dashboard/.
 */
export default function DashboardScreen() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || '';
  const queryClient = useQueryClient();
  const [chartRange, setChartRange] = useState(7);

  // ── Data Queries ──────────────────────────────────────────────────────────

  const statsQuery = useQuery({
    queryKey: ['dashboard-stats', workspaceId],
    queryFn: async () => window.ipc.invoke('dashboard:stats' as any, { workspaceId }),
    enabled: !!workspaceId
  });

  const chartQuery = useQuery({
    queryKey: ['dashboard-chart', workspaceId, chartRange],
    queryFn: async () =>
      window.ipc.invoke('dashboard:chart-data' as any, { workspaceId, days: chartRange }),
    enabled: !!workspaceId
  });

  const feedQuery = useQuery({
    queryKey: ['dashboard-feed', workspaceId],
    queryFn: async () => {
      const rows = await window.ipc.invoke('dashboard:activity-feed' as any, {
        workspaceId,
        limit: 30
      });
      return rows.map((act: any) => ({
        id: act.id || Math.random().toString(),
        type: act.type || 'tag_added',
        content: act.message || 'Action executed successfully.',
        createdAt: act.timestamp || new Date().toISOString()
      }));
    },
    enabled: !!workspaceId
  });

  const infraQuery = useQuery({
    queryKey: ['infrastructure-status', workspaceId],
    queryFn: async () =>
      window.ipc.invoke('system:infrastructure-status' as any, { workspaceId }),
    enabled: !!workspaceId,
    refetchInterval: 5000
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const toggleInfraMutation = useMutation({
    mutationFn: async (shouldRun: boolean) => {
      await window.ipc.invoke(
        'electron:setActiveWorkspace' as any,
        shouldRun ? workspaceId : null
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['infrastructure-status', workspaceId] });
      toast.success('System infrastructure toggled.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to toggle infrastructure.');
    }
  });

  const handleToggleInfrastructure = () => {
    const isRunning = infraStatus.workspaceRuntime?.status === 'Running';
    toggleInfraMutation.mutate(!isRunning);
  };

  const handleRefresh = () => {
    feedQuery.refetch();
    statsQuery.refetch();
    chartQuery.refetch();
    toast.success('Dashboard metrics updated.');
  };

  // ── Invoke ready-to-show once initial data loaded (PRD-002) ───────────────

  React.useEffect(() => {
    if (
      workspaceId &&
      !statsQuery.isLoading &&
      !chartQuery.isLoading &&
      !feedQuery.isLoading &&
      !infraQuery.isLoading
    ) {
      const rendererInitStart = (window as any).__rendererInitStart || 0;
      const reactMountTime    = (window as any).__reactMountTime   || 0;
      const dashboardReadyTime = performance.now();

      window.ipc
        .invoke('electron:ready-to-show' as any, {
          rendererInitStart,
          reactMountTime,
          dashboardReadyTime
        })
        .catch(() => {});
    }
  }, [
    workspaceId,
    statsQuery.isLoading,
    chartQuery.isLoading,
    feedQuery.isLoading,
    infraQuery.isLoading
  ]);

  // ── Derived values ────────────────────────────────────────────────────────

  const infraStatus = infraQuery.data || {
    workspaceRuntime:  { status: 'Stopped', uptimeMs: 0, restartCount: 0 },
    scheduler:         { status: 'Stopped', uptimeMs: 0 },
    syncEngine:        { status: 'Stopped', uptimeMs: 0 },
    automationRuntime: { status: 'Stopped', uptimeMs: 0 },
    workerHost:        { status: 'Stopped', activeWorkers: 0 },
    database:          { status: 'Connected' }
  };

  const isSystemRunning = infraStatus.workspaceRuntime?.status === 'Running';

  // Calculate total automation executions dynamically from metrics
  const totalExecutions = statsQuery.data
    ? (statsQuery.data.completedCount || 0) +
      (statsQuery.data.runningCount || 0) +
      (statsQuery.data.waitingCount || 0) +
      (statsQuery.data.failedCount || 0) +
      (statsQuery.data.pausedCount || 0) +
      (statsQuery.data.repliedCount || 0)
    : 0;

  const dbStatusBadge = (
    <span className="text-[10px] font-mono text-muted-foreground bg-surface-3 border border-border-subtle px-2 py-1 rounded-[--radius-sm]">
      DB: {infraStatus.database?.status || 'Connected'}
    </span>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 h-full overflow-y-auto pr-0.5 pb-2">
      {/* Header */}
      <PageHeader
        title="Workspace Overview"
        description="Track lead performance, campaign progress, and live orchestrations."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              className="gap-1.5"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              <span>Sync Stats</span>
            </Button>
            {dbStatusBadge}
          </div>
        }
      />

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Companies"
          value={statsQuery.data?.totalCompanies ?? 0}
          Icon={Building2}
          iconClass="text-primary"
          isLoading={statsQuery.isLoading}
        />
        <MetricCard
          label="Total Contacts"
          value={statsQuery.data?.totalContacts ?? 0}
          Icon={Users}
          iconClass="text-info"
          isLoading={statsQuery.isLoading}
        />
        <MetricCard
          label="Outreach Campaigns"
          value={statsQuery.data?.totalCampaigns ?? 0}
          Icon={Megaphone}
          iconClass="text-warning"
          isLoading={statsQuery.isLoading}
        />
        <MetricCard
          label="Automation Executions"
          value={totalExecutions}
          Icon={Zap}
          iconClass="text-success"
          isLoading={statsQuery.isLoading}
        />
      </div>

      {/* Analytics row: Outreach activity + Workflow Health breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <OutreachChart
            data={chartQuery.data || []}
            isLoading={chartQuery.isLoading}
            range={chartRange}
            onRangeChange={setChartRange}
          />
        </div>
        <WorkflowAnalytics
          stats={statsQuery.data}
          isLoading={statsQuery.isLoading}
        />
      </div>

      {/* Systems row: Infrastructure monitoring + Live Activities log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <InfraStatusPanel
            infraStatus={infraStatus}
            isSystemRunning={isSystemRunning}
            isToggling={toggleInfraMutation.isPending}
            onToggle={handleToggleInfrastructure}
          />
        </div>
        <ActivityFeed
          events={feedQuery.data || []}
          isLoading={feedQuery.isLoading}
        />
      </div>
    </div>
  );
}
