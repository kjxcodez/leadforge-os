import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '../hooks/useWorkspace';
import { TimelineView } from '../components/crm/TimelineView';
import { Skeleton } from '../components/ui/skeleton';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia
} from '../components/ui/empty';
import { Button } from '../components/ui/button';
import {
  Building2,
  Users,
  Megaphone,
  Activity,
  Play,
  StopCircle,
  Zap,
  Clock,
  Terminal,
  Server,
  RefreshCw,
  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * DashboardScreen displays workspace-wide aggregate metrics, Outreach Activity Charts,
 * live infrastructure statuses, and the real-time activity log feed.
 */
export default function DashboardScreen() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || '';
  const queryClient = useQueryClient();

  const [chartRange, setChartRange] = useState<number>(7);

  // ── Telemetry / Stats Queries ───────────────────────────────────────────

  const statsQuery = useQuery({
    queryKey: ['dashboard-stats', workspaceId],
    queryFn: async () => {
      return window.ipc.invoke('dashboard:stats' as any, { workspaceId });
    },
    enabled: !!workspaceId
  });

  const chartQuery = useQuery({
    queryKey: ['dashboard-chart', workspaceId, chartRange],
    queryFn: async () => {
      return window.ipc.invoke('dashboard:chart-data' as any, { workspaceId, days: chartRange });
    },
    enabled: !!workspaceId
  });

  const feedQuery = useQuery({
    queryKey: ['dashboard-feed', workspaceId],
    queryFn: async () => {
      const rows = await window.ipc.invoke('dashboard:activity-feed' as any, { workspaceId, limit: 30 });
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
    queryFn: async () => {
      return window.ipc.invoke('system:infrastructure-status' as any, { workspaceId });
    },
    enabled: !!workspaceId,
    refetchInterval: 5000 // Poll every 5s for live uptime and heartbeats
  });

  // ── Infrastructure Trigger Mutation ──────────────────────────────────────

  const toggleInfraMutation = useMutation({
    mutationFn: async (shouldRun: boolean) => {
      await window.ipc.invoke('electron:setActiveWorkspace' as any, shouldRun ? workspaceId : null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['infrastructure-status', workspaceId] });
      toast.success('System infrastructure toggled successfully.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to toggle system infrastructure.');
    }
  });

  const handleToggleInfrastructure = () => {
    const isRunning = infraQuery.data?.workspaceRuntime?.status === 'Running';
    toggleInfraMutation.mutate(!isRunning);
  };

  const handleRefreshFeed = () => {
    feedQuery.refetch();
    statsQuery.refetch();
    chartQuery.refetch();
    toast.success('Dashboard metrics updated.');
  };

  // ── Calculations ─────────────────────────────────────────────────────────

  const totalCompanies = statsQuery.data?.totalCompanies ?? 0;
  const totalContacts = statsQuery.data?.totalContacts ?? 0;
  const totalCampaigns = statsQuery.data?.totalCampaigns ?? 0;
  const totalExecutions = statsQuery.data?.totalExecutions ?? 0;

  const chartData = chartQuery.data || [];
  const maxChartVal = Math.max(
    ...chartData.map((day: any) => (day.emailsSent || 0) + (day.contactsCreated || 0) + (day.executions || 0)),
    10 // Fallback ceiling divisor
  );

  const infraStatus = infraQuery.data || {
    workspaceRuntime: { status: 'Stopped', uptimeMs: 0, restartCount: 0 },
    scheduler: { status: 'Stopped', uptimeMs: 0, latencyMs: 0 },
    syncEngine: { status: 'Stopped', uptimeMs: 0, lastHeartbeat: null },
    automationRuntime: { status: 'Stopped', uptimeMs: 0 },
    workerHost: { status: 'Stopped', activeWorkers: 0 },
    ipcBridge: { status: 'Running' },
    database: { status: 'Connected' }
  };

  const isSystemRunning = infraStatus.workspaceRuntime?.status === 'Running';

  // Format uptime milliseconds into human readable
  const formatUptime = (ms: number) => {
    if (!ms || ms <= 0) return '0s';
    const sec = Math.floor(ms / 1000) % 60;
    const min = Math.floor(ms / (1000 * 60)) % 60;
    const hr = Math.floor(ms / (1000 * 60 * 60));
    return `${hr > 0 ? hr + 'h ' : ''}${min > 0 ? min + 'm ' : ''}${sec}s`;
  };

  // Format bytes into human readable sizes
  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Invoke ready-to-show once all queries complete loading (PRD-002)
  React.useEffect(() => {
    if (workspaceId && !statsQuery.isLoading && !chartQuery.isLoading && !feedQuery.isLoading && !infraQuery.isLoading) {
      const rendererInitStart = (window as any).__rendererInitStart || 0;
      const reactMountTime = (window as any).__reactMountTime || 0;
      const dashboardReadyTime = performance.now();

      window.ipc.invoke('electron:ready-to-show' as any, {
        rendererInitStart,
        reactMountTime,
        dashboardReadyTime
      }).catch((err) => {
        console.log('Failed to invoke electron:ready-to-show:', err);
      });
    }
  }, [workspaceId, statsQuery.isLoading, chartQuery.isLoading, feedQuery.isLoading, infraQuery.isLoading]);

  return (
    <div className="space-y-6 text-xs font-sans h-full overflow-y-auto pr-1">
      {/* Header bar */}
      <div className="flex justify-between items-end border-b border-border-subtle pb-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Workspace Overview</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Track lead performance, campaign progress, and live orchestrations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="xs"
            onClick={handleRefreshFeed}
            className="flex items-center gap-1.5 text-[10px] text-secondary hover:text-foreground"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Sync Stats</span>
          </Button>
          <span className="text-[9px] font-mono text-muted-foreground bg-sunken border border-border-subtle px-2 py-0.5 rounded">
            DB status: {infraStatus.database?.status || 'Connected'}
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Companies',
            value: totalCompanies,
            icon: Building2,
            color: 'text-accent',
            isLoading: statsQuery.isLoading
          },
          {
            label: 'Total Contacts',
            value: totalContacts,
            icon: Users,
            color: 'text-indigo-500',
            isLoading: statsQuery.isLoading
          },
          {
            label: 'Outreach Campaigns',
            value: totalCampaigns,
            icon: Megaphone,
            color: 'text-orange-500',
            isLoading: statsQuery.isLoading
          },
          {
            label: 'Automation Executions',
            value: totalExecutions,
            icon: Zap,
            color: 'text-emerald-500',
            isLoading: statsQuery.isLoading
          }
        ].map((item, i) => (
          <div
            key={i}
            className="bg-card border border-border-subtle p-4 rounded-xl flex items-center justify-between hover:shadow-sm transition-shadow"
          >
            <div className="space-y-1.5 flex-1 min-w-0">
              <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider block truncate">
                {item.label}
              </span>
              {item.isLoading ? (
                <Skeleton className="h-5 w-16" />
              ) : (
                <div className="text-lg font-bold text-foreground leading-none">{item.value}</div>
              )}
            </div>
            <div className={`w-8 h-8 rounded bg-card border border-border-subtle flex items-center justify-center shrink-0 ml-3 ${item.color}`}>
              <item.icon className="w-4 h-4" />
            </div>
          </div>
        ))}
      </div>

      {/* Chart and Activity Feed Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Column */}
        <div className="lg:col-span-2 bg-card border border-border-subtle rounded-xl flex flex-col justify-between p-5 space-y-4 shadow-sm">
          <div className="flex justify-between items-center border-b border-border-subtle pb-3">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-accent" />
              <h3 className="text-[10px] font-bold uppercase text-foreground tracking-wider">Outreach Activity</h3>
            </div>
            
            {/* Timeframe Selectors */}
            <div className="flex bg-sunken border border-border-subtle p-0.5 rounded gap-0.5">
              {[
                { label: '7D', val: 7 },
                { label: '30D', val: 30 },
                { label: '90D', val: 90 }
              ].map((time) => (
                <button
                  key={time.val}
                  onClick={() => setChartRange(time.val)}
                  className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all ${
                    chartRange === time.val
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-muted hover:text-secondary'
                  }`}
                >
                  {time.label}
                </button>
              ))}
            </div>
          </div>

          {/* Chart visual container */}
          {chartQuery.isLoading ? (
            <div className="h-[180px] flex flex-col justify-end gap-2.5">
              <Skeleton className="w-full h-full rounded" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center border border-dashed border-border-subtle rounded-lg bg-sunken/15">
              <span className="text-muted-foreground text-[11px]">No activity logs found for this period.</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="h-[170px] flex items-end justify-between gap-3 px-2">
                {chartData.map((day: any, idx: number) => {
                  const emailH = ((day.emailsSent || 0) / maxChartVal) * 100;
                  const contactH = ((day.contactsCreated || 0) / maxChartVal) * 100;
                  const execH = ((day.executions || 0) / maxChartVal) * 100;
                  
                  return (
                    <div key={idx} className="flex-1 flex flex-col justify-end h-full group relative cursor-pointer">
                      {/* Rich tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col bg-popover text-foreground border border-border-default rounded-lg p-2.5 shadow-xl z-50 text-[10px] font-mono whitespace-nowrap gap-1">
                        <div className="font-semibold text-center border-b border-border-subtle pb-1 mb-1 text-[9px] text-muted-foreground">{day.day}</div>
                        <div className="text-accent flex items-center gap-1.5 font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                          Workflows: {day.executions || 0}
                        </div>
                        <div className="text-indigo-400 flex items-center gap-1.5 font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                          Emails: {day.emailsSent || 0}
                        </div>
                        <div className="text-emerald-400 flex items-center gap-1.5 font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Contacts: {day.contactsCreated || 0}
                        </div>
                      </div>

                      {/* Segments (flex-col layouts stack nicely) */}
                      <div className="bg-accent rounded-t w-full transition-all duration-300 hover:brightness-110" style={{ height: `${execH}%` }} />
                      <div className="bg-indigo-500 w-full transition-all duration-300 hover:brightness-110" style={{ height: `${emailH}%` }} />
                      <div className="bg-emerald-500 w-full transition-all duration-300 hover:brightness-110" style={{ height: `${contactH}%` }} />
                    </div>
                  );
                })}
              </div>

              {/* Chart Legend */}
              <div className="flex justify-between items-center text-[9px] text-muted-foreground font-mono border-t border-border-subtle pt-2">
                <span>{chartData[0]?.day}</span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    <span>Workflows</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    <span>Emails</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Contacts</span>
                  </div>
                </div>
                <span>{chartData[chartData.length - 1]?.day}</span>
              </div>
            </div>
          )}
        </div>

        {/* Activity Feed Column */}
        <div className="bg-card border border-border-subtle rounded-xl flex flex-col p-4 space-y-3 shadow-sm h-[290px]">
          <div className="border-b border-border-subtle pb-2 flex justify-between items-center">
            <h3 className="text-[10px] font-bold uppercase text-foreground tracking-wider">Recent Activity</h3>
            <span className="text-[9px] text-muted-foreground font-mono">Live Logs</span>
          </div>
          <div className="flex-1 overflow-y-auto pr-1">
            {feedQuery.isLoading ? (
              <div className="space-y-4 py-2">
                <Skeleton className="h-10 w-full rounded" />
                <Skeleton className="h-10 w-full rounded" />
                <Skeleton className="h-10 w-full rounded" />
              </div>
            ) : (
              <TimelineView events={feedQuery.data || []} isLoading={false} />
            )}
          </div>
        </div>
      </div>

      {/* Live Infrastructure Panel */}
      <div className="bg-card border border-border-subtle rounded-xl p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border-subtle pb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Server className="h-4 w-4 text-accent" />
              <span className="text-[10px] text-foreground uppercase tracking-wider font-bold">
                System Infrastructure Status
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">Monitor isolated syncs, trigger monitors, and database latency.</p>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <div className="text-right text-[10px] text-muted-foreground font-mono leading-relaxed">
              <div>Uptime: <span className="font-semibold text-foreground">{formatUptime(infraStatus.workspaceRuntime?.uptimeMs)}</span></div>
              <div>Restarts: <span className="font-semibold text-foreground">{infraStatus.workspaceRuntime?.restartCount || 0}</span></div>
              <div>Memory: <span className="font-semibold text-foreground">{formatBytes(infraStatus.workspaceRuntime?.memoryUsage)}</span></div>
              <div>Startup: <span className="font-semibold text-foreground">{infraStatus.workspaceRuntime?.startupDuration || 0}ms</span></div>
              <div>Avg Boot: <span className="font-semibold text-foreground">{infraStatus.workspaceRuntime?.averageStartupTime ? Math.round(infraStatus.workspaceRuntime.averageStartupTime) : 0}ms</span></div>
            </div>
            <Button
              onClick={handleToggleInfrastructure}
              size="sm"
              disabled={toggleInfraMutation.isPending}
              variant={isSystemRunning ? 'destructive' : 'default'}
              className="text-xs font-semibold gap-1.5 active:scale-[0.98] shrink-0"
            >
              {isSystemRunning ? <StopCircle className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{isSystemRunning ? 'Stop Engine' : 'Start Engine'}</span>
            </Button>
          </div>
        </div>

        {/* Detailed services statuses grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              name: 'Scheduler Engine',
              status: infraStatus.scheduler?.status || 'Stopped',
              uptime: formatUptime(infraStatus.scheduler?.uptimeMs),
              icon: Clock
            },
            {
              name: 'Sync Engine',
              status: infraStatus.syncEngine?.status || 'Stopped',
              uptime: formatUptime(infraStatus.syncEngine?.uptimeMs),
              icon: RefreshCw
            },
            {
              name: 'Automation Evaluator',
              status: infraStatus.automationRuntime?.status || 'Stopped',
              uptime: formatUptime(infraStatus.automationRuntime?.uptimeMs),
              icon: Zap
            },
            {
              name: 'Worker Thread Pool',
              status: infraStatus.workerHost?.status || 'Stopped',
              uptime: `${infraStatus.workerHost?.activeWorkers || 0} threads`,
              icon: Terminal
            }
          ].map((srv, idx) => (
            <div key={idx} className="bg-sunken border border-border-subtle rounded-xl p-3.5 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold text-secondary truncate">{srv.name}</span>
                <srv.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </div>
              <div className="flex items-end justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${srv.status === 'Running' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  <span className="font-bold text-[10px] text-foreground uppercase">{srv.status}</span>
                </div>
                <span className="text-[9px] font-mono text-muted">{srv.uptime}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
