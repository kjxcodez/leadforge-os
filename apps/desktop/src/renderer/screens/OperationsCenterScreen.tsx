import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '../hooks/useWorkspace';
import { Tabs, TabsContent } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import {
  Activity,
  History,
  AlertTriangle,
  Server,
  Wrench,
  Terminal,
  FileText,
  Copy,
  Download,
  RotateCcw,
  ShieldCheck,
  Percent,
  Search,
  SlidersHorizontal,
  CheckCircle2,
  Eye,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';
import { PageHeader } from '../components/common/PageHeader';
import { motion } from 'framer-motion';

/**
 * OperationsCenterScreen — SRE Observability Cockpit.
 *
 * Design updates:
 *   - Squared corners: all widgets, buttons, dialogs, progress bars, selects, textareas, and badges use rounded-none.
 *   - Design System Colors: matches primary/success/warning/info/danger tokens.
 *   - Custom Sliding Tab Bar: Framer Motion animated tab headers with snappy spring physics.
 *   - Client-side Table Pagination: handles large log grids smoothly.
 */
export function OperationsCenterScreen() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || '';
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [logSearch, setLogSearch] = useState('');
  const [logSeverity, setLogSeverity] = useState('all');
  const [devModeActive, setDevModeActive] = useState(false);
  const [devEvents, setDevEvents] = useState<any[]>([]);

  // Beta feedback state hooks
  const [feedbackType, setFeedbackType] = useState('bug');
  const [feedbackDescription, setFeedbackDescription] = useState('');
  const [bugSeverity, setBugSeverity] = useState('medium');
  const [bugReproducibility, setBugReproducibility] = useState('always');
  const [isExportingBundle, setIsExportingBundle] = useState(false);

  // Pagination states
  const [timelinePage, setTimelinePage] = useState(1);
  const [timelinePerPage] = useState(10);

  const [logsPage, setLogsPage] = useState(1);
  const [logsPerPage] = useState(15);

  const handleTimelinePageChange = useCallback((page: number) => {
    setTimelinePage(page);
  }, []);

  const handleLogsPageChange = useCallback((page: number) => {
    setLogsPage(page);
  }, []);

  // 1. Fetch live jobs scheduler list
  const queueQuery = useQuery({
    queryKey: ['scheduler_queue', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return { jobs: [], waiting: [] };
      return window.ipc.invoke('scheduler:queue:list', { workspaceId });
    },
    enabled: !!workspaceId,
    refetchInterval: 3000
  });

  // 1b. Fetch authoritative infrastructure status
  const infraQuery = useQuery({
    queryKey: ['infrastructure-status', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      return window.ipc.invoke('system:infrastructure-status' as any, { workspaceId });
    },
    enabled: !!workspaceId,
    refetchInterval: 4000
  });

  // 2. Fetch structured logs
  const logsQuery = useQuery({
    queryKey: ['system_logs', workspaceId, logSearch, logSeverity],
    queryFn: async () => {
      if (!workspaceId) return [];
      return window.ipc.invoke('system-logs:query', {
        workspaceId,
        query: logSearch,
        severity: logSeverity,
        limit: 150
      });
    },
    enabled: !!workspaceId,
    refetchInterval: 5000
  });

  // 3. Fetch audit logs
  const auditQuery = useQuery({
    queryKey: ['audit_logs', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      return window.ipc.invoke('audit-logs:list', { workspaceId, limit: 100 });
    },
    enabled: !!workspaceId
  });

  // 4. Fetch SRE diagnostics
  const diagnosticsQuery = useQuery({
    queryKey: ['diagnostics', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      return window.ipc.invoke('diagnostics:run', { workspaceId });
    },
    enabled: !!workspaceId,
    refetchInterval: 8000
  });

  // 4b. Fetch detailed system information diagnostics
  const systemInfoQuery = useQuery({
    queryKey: ['system_info', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      return window.ipc.invoke('diagnostics:get-system-info', { workspaceId });
    },
    enabled: !!workspaceId,
    refetchInterval: 8000
  });

  // 5. Fetch performance metrics
  const metricsQuery = useQuery({
    queryKey: ['performance_metrics', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      return window.ipc.invoke('metrics:get', { workspaceId });
    },
    enabled: !!workspaceId
  });

  // 6. Fetch failed/error console jobs
  const errorsQuery = useQuery({
    queryKey: ['error_console_jobs', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      return window.ipc.invoke('errors:get', { workspaceId });
    },
    enabled: !!workspaceId,
    refetchInterval: 5000
  });

  // SRE recovery execution mutation
  const recoveryMutation = useMutation({
    mutationFn: async (params: { action: string; targetId?: string }) => {
      return window.ipc.invoke('recovery:execute', { workspaceId, ...params });
    },
    onSuccess: (res: any) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ['scheduler_queue'] });
        queryClient.invalidateQueries({ queryKey: ['error_console_jobs'] });
      } else {
        toast.error(res.message);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Recovery trigger failed.');
    }
  });

  // Poll developer mode logs in real-time
  useEffect(() => {
    if (!devModeActive) return;
    const interval = setInterval(async () => {
      try {
        const events = await window.ipc.invoke('dev-mode:log', { workspaceId });
        setDevEvents(events || []);
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [devModeActive, workspaceId]);

  if (!workspaceId) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 h-full text-muted-foreground font-sans">
        <SlidersHorizontal className="h-10 w-10 mb-2 opacity-50 text-primary" />
        <p className="text-sm font-medium">Select a workspace to enter Operations Center</p>
      </div>
    );
  }

  const jobsList = queueQuery.data?.jobs || [];
  const waitingList = queueQuery.data?.waiting || [];
  const runningJobs = jobsList.filter((j: any) => j.status === 'running');
  const queuedJobs = jobsList.filter((j: any) => j.status === 'queued' || j.status === 'starting');
  const failedJobs = jobsList.filter((j: any) => j.status === 'failed');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleExportJson = (data: any, fileName: string) => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `${fileName}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportSupportBundle = async () => {
    setIsExportingBundle(true);
    try {
      const res = await window.ipc.invoke('diagnostics:export-support-bundle', { workspaceId });
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message || 'Support bundle export failed.');
    } finally {
      setIsExportingBundle(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackDescription.trim()) {
      toast.error('Feedback description is required.');
      return;
    }

    let body = '';
    let title = '';

    if (feedbackType === 'bug') {
      title = `[BUG] ${feedbackDescription.substring(0, 50)}`;
      body = `### Bug Description\n${feedbackDescription}\n\n### Metadata\n- **Severity**: ${bugSeverity.toUpperCase()}\n- **Reproducibility**: ${bugReproducibility}\n- **OS Platform**: ${navigator.platform}\n- **Workspace ID**: ${workspaceId}\n\n*Diagnostics have been copied to your clipboard. Please paste them in this issue.*`;
    } else if (feedbackType === 'feature') {
      title = `[FEATURE] ${feedbackDescription.substring(0, 50)}`;
      body = `### Feature Proposal\n${feedbackDescription}\n\n### Metadata\n- **OS Platform**: ${navigator.platform}\n\n*Diagnostics have been copied to your clipboard. Please paste them in this issue.*`;
    } else {
      title = `[FEEDBACK] General thoughts`;
      body = `### Feedback\n${feedbackDescription}\n\n*Diagnostics have been copied to your clipboard. Please paste them in this issue.*`;
    }

    // Fetch and Copy diagnostics
    try {
      const info = await window.ipc.invoke('diagnostics:get-system-info', { workspaceId });
      navigator.clipboard.writeText(JSON.stringify(info, null, 2));
      toast.success('Diagnostics copied to clipboard!');
    } catch {
      toast.error('Failed to copy diagnostics to clipboard.');
    }

    const repoUrl = 'https://github.com/kjxcodez/leadforge-os/issues/new';
    const url = `${repoUrl}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    window.open(url);
    toast.success('Opening GitHub Issue page in browser...');
    setFeedbackDescription('');
  };

  const getBadgeClass = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'running':
      case 'active':
      case 'healthy':
      case 'operating':
        return 'bg-success-muted text-success border border-success/20 rounded-none';
      case 'queued':
      case 'starting':
      case 'waiting':
      case 'warning':
      case 'medium':
        return 'bg-warning-muted text-warning border border-warning/20 rounded-none';
      case 'failed':
      case 'critical':
      case 'high':
        return 'bg-danger-muted text-danger border border-danger/20 rounded-none';
      default:
        return 'bg-muted-muted text-muted-foreground border-border-subtle rounded-none';
    }
  };

  // Pagination calculation: Event Trace Timeline
  const rawEvents = auditQuery.data || [];
  const totalTimeline = rawEvents.length;
  const totalTimelinePages = Math.ceil(totalTimeline / timelinePerPage);
  const adjustedTimelinePage = Math.min(Math.max(1, timelinePage), totalTimelinePages || 1);
  const timelineStartIndex = (adjustedTimelinePage - 1) * timelinePerPage;
  const paginatedTimeline = rawEvents.slice(timelineStartIndex, timelineStartIndex + timelinePerPage);

  // Pagination calculation: Structured Logs
  const rawLogs = logsQuery.data || [];
  const totalLogs = rawLogs.length;
  const totalLogsPages = Math.ceil(totalLogs / logsPerPage);
  const adjustedLogsPage = Math.min(Math.max(1, logsPage), totalLogsPages || 1);
  const logsStartIndex = (adjustedLogsPage - 1) * logsPerPage;
  const paginatedLogs = rawLogs.slice(logsStartIndex, logsStartIndex + logsPerPage);

  return (
    <div className="space-y-6 text-xs font-sans h-full overflow-y-auto pr-1 select-none">
      <PageHeader
        title="Operations Center"
        description="Real-time telemetry, SRE tracing, error recovery, and system diagnostics."
        actions={
          <div className="flex gap-2 items-center">
            <Button
              type="button"
              size="sm"
              variant={devModeActive ? 'default' : 'outline'}
              className="h-7 text-[10px] rounded-none"
              onClick={() => setDevModeActive(!devModeActive)}
            >
              <Terminal className="h-3 w-3 mr-1" />
              Developer Mode: {devModeActive ? 'ON' : 'OFF'}
            </Button>
            {(() => {
              const schedulerStatus = infraQuery.data?.scheduler?.status;
              const isSchedulerActive = schedulerStatus === 'Running' || schedulerStatus === 'Active' || schedulerStatus === 'ACTIVE';
              return (
                <Badge
                  className={
                    isSchedulerActive
                      ? 'bg-success-muted text-success border border-success/20 font-semibold rounded-none'
                      : 'bg-muted-muted text-muted-foreground border border-border-subtle font-semibold rounded-none'
                  }
                >
                  Scheduler Status: {isSchedulerActive ? 'Active' : 'Stopped'}
                </Badge>
              );
            })()}
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        {/* custom sliding active underline tab list */}
        <div className="border-b border-border-subtle flex gap-4 w-full relative mb-4 flex-wrap">
          {[
            { id: 'dashboard', label: 'Dashboard', Icon: Server },
            { id: 'timeline', label: 'Global Timeline', Icon: History },
            { id: 'logs', label: 'Structured Logs', Icon: FileText },
            { id: 'diagnostics', label: 'Diagnostics', Icon: ShieldCheck },
            { id: 'metrics', label: 'Performance', Icon: Percent },
            { id: 'errors', label: 'Error Console', Icon: AlertTriangle },
            { id: 'recovery', label: 'SRE Recovery', Icon: Wrench }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative pb-3 px-1 flex items-center gap-1.5 rounded-none text-xs font-semibold select-none outline-none z-10 transition-colors duration-200 ${
                  isActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-primary'
                }`}
              >
                <tab.Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="operationsActiveTabUnderline"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary"
                    transition={{ type: 'spring', stiffness: 550, damping: 38 }}
                  />
                )}
              </button>
            );
          })}
          {devModeActive && (
            <button
              type="button"
              onClick={() => setActiveTab('developer')}
              className={`relative pb-3 px-1 flex items-center gap-1.5 rounded-none text-xs font-semibold select-none outline-none z-10 transition-colors duration-200 ${
                activeTab === 'developer' ? 'text-primary font-bold' : 'text-muted-foreground hover:text-primary'
              }`}
            >
              <Terminal className="h-3.5 w-3.5" />
              <span>Dev Engine</span>
              {activeTab === 'developer' && (
                <motion.div
                  layoutId="operationsActiveTabUnderline"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary"
                  transition={{ type: 'spring', stiffness: 550, damping: 38 }}
                />
              )}
            </button>
          )}
        </div>

        {/* 1. Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-4 outline-none mt-0">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-card border border-border-subtle rounded-none p-3 flex flex-col justify-between shadow-sm">
              <span className="text-muted-foreground text-[10px] font-semibold uppercase">Active Workers</span>
              <div className="flex items-end justify-between mt-2">
                <span className="text-xl font-bold text-foreground font-mono">{runningJobs.length}</span>
                <span className="text-[10px] text-success font-semibold flex items-center gap-1.5">
                  <span className="h-2 w-2 bg-success animate-pulse shrink-0" /> Live
                </span>
              </div>
            </div>
            <div className="bg-card border border-border-subtle rounded-none p-3 flex flex-col justify-between shadow-sm">
              <span className="text-muted-foreground text-[10px] font-semibold uppercase">Queued Tasks</span>
              <div className="flex items-end justify-between mt-2">
                <span className="text-xl font-bold text-foreground font-mono">{queuedJobs.length}</span>
                <span className="text-[10px] text-warning font-semibold">In-Queue</span>
              </div>
            </div>
            <div className="bg-card border border-border-subtle rounded-none p-3 flex flex-col justify-between shadow-sm">
              <span className="text-muted-foreground text-[10px] font-semibold uppercase font-sans">
                Dead Letter / Failures
              </span>
              <div className="flex items-end justify-between mt-2">
                <span className="text-xl font-bold text-danger font-mono">{failedJobs.length}</span>
                {failedJobs.length > 0 && (
                  <Badge className="bg-danger-muted text-danger border border-danger/20 text-[9px] font-bold rounded-none">
                    Action Required
                  </Badge>
                )}
              </div>
            </div>
            <div className="bg-card border border-border-subtle rounded-none p-3 flex flex-col justify-between shadow-sm">
              <span className="text-muted-foreground text-[10px] font-semibold uppercase">
                Backlog Queue Size
              </span>
              <div className="flex items-end justify-between mt-2">
                <span className="text-xl font-bold text-foreground font-mono">{waitingList.length}</span>
                <span className="text-[10px] text-zinc-500 font-semibold">Scheduled Email Sends</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Live Scheduler Queue */}
            <div className="bg-card border border-border-subtle rounded-none p-4 space-y-3 shadow-sm">
              <h3 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                <Server className="h-4 w-4 text-primary" />
                Live Job Scheduler Queue
              </h3>
              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                {jobsList.length === 0 ? (
                  <p className="text-muted-foreground text-[10px] italic py-4 text-center">
                    No active or recently completed jobs in queue.
                  </p>
                ) : (
                  jobsList.map((job: any) => (
                    <div
                      key={job.id}
                      className="bg-surface-3 border border-border-subtle rounded-none p-2.5 flex justify-between items-center gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground">{job.type}</span>
                          <Badge className={getBadgeClass(job.status)}>
                            {job.status}
                          </Badge>
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-0.5 font-mono">
                          Correlation ID: {job.id.substring(0, 8)}...
                        </p>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">{job.progress}%</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Scheduler Status & Database Health */}
            <div className="bg-card border border-border-subtle rounded-none p-4 space-y-3 shadow-sm">
              <h3 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Operational Status Checkpoints
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center py-1.5 border-b border-border-subtle/50">
                  <span className="font-semibold text-foreground">SQLite Database</span>
                  <Badge className="bg-success-muted text-success border border-success/20 font-bold rounded-none">
                    Healthy
                  </Badge>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-border-subtle/50">
                  <span className="font-semibold text-foreground">Worker Host Runtime</span>
                  <Badge className="bg-success-muted text-success border border-success/20 font-bold rounded-none">
                    Operating
                  </Badge>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-border-subtle/50">
                  <span className="font-semibold text-foreground">Internet Connectivity</span>
                  <Badge className="bg-success-muted text-success border border-success/20 font-bold rounded-none">
                    Connected
                  </Badge>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="font-semibold text-foreground">Background Sync Dispatcher</span>
                  <Badge className="bg-success-muted text-success border border-success/20 font-bold rounded-none">
                    Idle
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 2. Global Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4 outline-none mt-0">
          <div className="bg-card border border-border-subtle rounded-none p-4 space-y-4 shadow-sm">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                <History className="h-4 w-4 text-primary" />
                Unified Event Tracing Timeline
              </h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-[10px] rounded-none"
                onClick={() => auditQuery.refetch()}
              >
                Refresh Timeline
              </Button>
            </div>

            <div className="relative border-l border-border-subtle ml-3 pl-5 space-y-5 max-h-[400px] overflow-y-auto pr-1">
              {paginatedTimeline.length === 0 ? (
                <p className="text-muted-foreground text-[10px] italic py-6 text-center">
                  No trace events recorded yet.
                </p>
              ) : (
                paginatedTimeline.map((event: any) => (
                  <div key={event.id} className="relative">
                    <span className="absolute -left-[26px] top-0.5 bg-surface-3 border border-border-subtle rounded-none h-3 w-3 flex items-center justify-center">
                      <span className="h-1.5 w-1.5 bg-primary rounded-none" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-[11px] uppercase tracking-wide">
                          {event.action}
                        </span>
                        <span className="text-[9px] text-muted-foreground font-mono">
                          {new Date(event.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Actor: {event.actor} | Entity ID:{' '}
                        <span className="font-mono text-muted-foreground">{event.entityId}</span> (
                        {event.entityType})
                      </p>
                      {event.beforeValue && (
                        <div className="mt-2 bg-surface-3 border border-border-subtle rounded-none p-2 font-mono text-[9px] text-muted-foreground overflow-x-auto">
                          <span className="font-semibold text-warning block mb-0.5">
                            State Before:
                          </span>
                          {event.beforeValue}
                        </div>
                      )}
                      {event.afterValue && (
                        <div className="mt-2 bg-surface-3 border border-border-subtle rounded-none p-2 font-mono text-[9px] text-muted-foreground overflow-x-auto">
                          <span className="font-semibold text-success block mb-0.5">
                            State After:
                          </span>
                          {event.afterValue}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Timeline Pagination controls */}
            {totalTimelinePages > 1 && (
              <div className="flex items-center justify-between border-t border-border-subtle pt-4 mt-2 select-none">
                <span className="text-[11px] text-muted-foreground">
                  Showing{' '}
                  <strong className="text-foreground font-mono">{timelineStartIndex + 1}</strong>{' '}
                  to{' '}
                  <strong className="text-foreground font-mono">
                    {Math.min(timelineStartIndex + timelinePerPage, totalTimeline)}
                  </strong>{' '}
                  of <strong className="text-foreground font-mono">{totalTimeline}</strong> traces
                </span>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleTimelinePageChange(Math.max(1, timelinePage - 1));
                    }}
                    disabled={adjustedTimelinePage === 1}
                    className="h-8 rounded-none px-3 text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleTimelinePageChange(Math.min(totalTimelinePages, timelinePage + 1));
                    }}
                    disabled={adjustedTimelinePage === totalTimelinePages}
                    className="h-8 rounded-none px-3 text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* 3. Structured Logs Tab */}
        <TabsContent value="logs" className="space-y-4 outline-none mt-0">
          <div className="bg-card border border-border-subtle rounded-none p-4 space-y-4 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <h3 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-primary" />
                System Structured Logs Console
              </h3>
              <div className="flex gap-2 items-center w-full md:w-auto">
                <div className="relative flex-1 md:w-48">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search logs..."
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    className="h-7 pl-8 text-[10px] rounded-none border-border-subtle bg-card"
                  />
                </div>
                <select
                  value={logSeverity}
                  onChange={(e) => setLogSeverity(e.target.value)}
                  className="bg-card border border-border-subtle rounded-none px-2 py-1 h-7 text-[10px] focus-visible:outline-none"
                >
                  <option value="all">All Levels</option>
                  <option value="info">Info</option>
                  <option value="warn">Warning</option>
                  <option value="error">Error</option>
                </select>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-7 w-7 rounded-none"
                  onClick={() => handleExportJson(logsQuery.data, 'system_logs')}
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="bg-surface-3 border border-border-subtle rounded-none p-3 font-mono text-[10px] max-h-[350px] overflow-y-auto space-y-1">
              {paginatedLogs.length === 0 ? (
                <p className="text-muted-foreground text-[10px] italic py-6 text-center">
                  No logs match the current filters.
                </p>
              ) : (
                paginatedLogs.map((log: any) => (
                  <div
                    key={log.id}
                    className="flex justify-between items-start hover:bg-card p-1 rounded-none gap-4"
                  >
                    <span className="text-[9px] text-slate-500 shrink-0">
                      [{new Date(log.timestamp).toLocaleTimeString()}]
                    </span>
                    <span
                      className={`font-semibold shrink-0 uppercase tracking-wide text-[9px] ${
                        log.severity === 'error'
                          ? 'text-danger'
                          : log.severity === 'warn'
                            ? 'text-warning'
                            : 'text-info'
                      }`}
                    >
                      {log.severity}
                    </span>
                    <span className="text-info font-semibold shrink-0 font-mono">[{log.task}]</span>
                    <p className="flex-1 text-foreground break-all">{log.message}</p>
                    {log.metadata && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-4 w-4 text-muted-foreground hover:text-foreground shrink-0 rounded-none"
                        onClick={() => copyToClipboard(JSON.stringify(log.metadata))}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Logs Pagination controls */}
            {totalLogsPages > 1 && (
              <div className="flex items-center justify-between border-t border-border-subtle pt-4 mt-2 select-none">
                <span className="text-[11px] text-muted-foreground">
                  Showing{' '}
                  <strong className="text-foreground font-mono">{logsStartIndex + 1}</strong>{' '}
                  to{' '}
                  <strong className="text-foreground font-mono">
                    {Math.min(logsStartIndex + logsPerPage, totalLogs)}
                  </strong>{' '}
                  of <strong className="text-foreground font-mono">{totalLogs}</strong> logs
                </span>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleLogsPageChange(Math.max(1, logsPage - 1));
                    }}
                    disabled={adjustedLogsPage === 1}
                    className="h-8 rounded-none px-3 text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleLogsPageChange(Math.min(totalLogsPages, logsPage + 1));
                    }}
                    disabled={adjustedLogsPage === totalLogsPages}
                    className="h-8 rounded-none px-3 text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* 4. Diagnostics Tab */}
        <TabsContent value="diagnostics" className="space-y-4 outline-none mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left Col: Metadata Table & Diagnostic Actions */}
            <div className="lg:col-span-2 space-y-4">
              {/* System Metadata Cockpit */}
              <div className="bg-card border border-border-subtle rounded-none p-4 space-y-3 shadow-sm">
                <h3 className="font-semibold text-foreground text-xs flex items-center gap-1.5 border-b border-border-subtle pb-2">
                  <Server className="h-4 w-4 text-primary" />
                  System Diagnostics & Specifications
                </h3>

                {systemInfoQuery.isLoading ? (
                  <p className="text-muted-foreground text-[10px] italic py-4 text-center">
                    Loading system specifications...
                  </p>
                ) : systemInfoQuery.data ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[10px]">
                    <div className="space-y-1 bg-surface-3 p-2 rounded-none border border-border-subtle/50">
                      <span className="text-muted-foreground block uppercase text-[8px] font-bold tracking-wider">
                        Application Version
                      </span>
                      <span className="font-semibold text-foreground font-mono">
                        v{systemInfoQuery.data.appVersion}-beta.1 (Unsigned Build)
                      </span>
                    </div>
                    <div className="space-y-1 bg-surface-3 p-2 rounded-none border border-border-subtle/50">
                      <span className="text-muted-foreground block uppercase text-[8px] font-bold tracking-wider">
                        Git Commit Hash
                      </span>
                      <span className="font-mono text-foreground">
                        {systemInfoQuery.data.gitCommit}
                      </span>
                    </div>
                    <div className="space-y-1 bg-surface-3 p-2 rounded-none border border-border-subtle/50">
                      <span className="text-muted-foreground block uppercase text-[8px] font-bold tracking-wider">
                        Electron / Node Runtime
                      </span>
                      <span className="font-semibold text-foreground font-mono">
                        v{systemInfoQuery.data.electronVersion} / {systemInfoQuery.data.nodeVersion}{' '}
                        ({systemInfoQuery.data.platform})
                      </span>
                    </div>
                    <div className="space-y-1 bg-surface-3 p-2 rounded-none border border-border-subtle/50">
                      <span className="text-muted-foreground block uppercase text-[8px] font-bold tracking-wider">
                        Workspace Database Info
                      </span>
                      <span className="font-semibold text-foreground font-mono">
                        SQLite v{systemInfoQuery.data.databaseVersion} (
                        {systemInfoQuery.data.activeWorkspaceId.substring(0, 8)}...)
                      </span>
                    </div>
                    <div className="space-y-1 bg-surface-3 p-2 rounded-none border border-border-subtle/50 font-mono">
                      <span className="text-muted-foreground block uppercase text-[8px] font-bold tracking-wider font-sans">
                        Database Migration Schema
                      </span>
                      <span className="text-foreground">
                        {systemInfoQuery.data.migrationVersion}
                      </span>
                    </div>
                    <div className="space-y-1 bg-surface-3 p-2 rounded-none border border-border-subtle/50">
                      <span className="text-muted-foreground block uppercase text-[8px] font-bold tracking-wider">
                        Background Engines Status
                      </span>
                      <span className="font-semibold text-foreground">
                        Scheduler: {systemInfoQuery.data.schedulerStatus} | Cache:{' '}
                        {systemInfoQuery.data.cacheStatus || 'Ready'}
                      </span>
                    </div>
                    <div className="space-y-1 bg-surface-3 p-2 rounded-none border border-border-subtle/50 sm:col-span-2">
                      <span className="text-muted-foreground block uppercase text-[8px] font-bold tracking-wider">
                        AI Execution Settings (OpenRouter Key MASKED)
                      </span>
                      <span className="font-semibold text-foreground">
                        Mode: {systemInfoQuery.data.aiProviderConfig.mode} | API Key Status:{' '}
                        {systemInfoQuery.data.aiProviderConfig.openRouterKey}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-[10px] italic py-4 text-center">
                    Failed to fetch system specifications.
                  </p>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] rounded-none"
                    onClick={() => copyToClipboard(JSON.stringify(systemInfoQuery.data, null, 2))}
                  >
                    <Copy className="h-3 w-3 mr-1" /> Copy Diagnostics
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] rounded-none"
                    onClick={() => handleExportJson(systemInfoQuery.data, 'diagnostics')}
                  >
                    <Download className="h-3 w-3 mr-1" /> Export Diagnostics JSON
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    disabled={isExportingBundle}
                    className="h-7 text-[10px] bg-primary hover:bg-primary/80 text-white rounded-none"
                    onClick={handleExportSupportBundle}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    {isExportingBundle ? 'Exporting...' : 'Export Support Bundle ZIP'}
                  </Button>
                </div>
              </div>

              {/* SRE Observability Verification Tests */}
              <div className="bg-card border border-border-subtle rounded-none p-4 space-y-4 shadow-sm">
                <div className="flex justify-between items-center border-b border-border-subtle pb-2">
                  <h3 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Local Diagnostics Triggers
                  </h3>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] rounded-none"
                    onClick={() => diagnosticsQuery.refetch()}
                  >
                    Run Health Checks
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {diagnosticsQuery.data ? (
                    Object.entries(diagnosticsQuery.data).map(([key, val]: [string, any]) => (
                      <div
                        key={key}
                        className="bg-surface-3 border border-border-subtle rounded-none p-2.5 flex flex-col justify-between gap-1"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-foreground uppercase text-[8px] tracking-wider">
                            {key}
                          </span>
                          <Badge className={getBadgeClass(val.status)}>
                            {val.status}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-[9px] mt-0.5">{val.message}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-[10px] italic py-4 text-center col-span-2">
                      Execute diagnostics test suite to verify connectivity and ports...
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Right Col: Feedback Panel */}
            <div className="bg-card border border-border-subtle rounded-none p-4 space-y-4 h-fit shadow-sm">
              <h3 className="font-semibold text-foreground text-xs flex items-center gap-1.5 border-b border-border-subtle pb-2">
                <Terminal className="h-4 w-4 text-primary" />
                Beta Feedback Cockpit
              </h3>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider block">
                    Feedback Category
                  </label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      className={`flex-1 py-1 text-[10px] font-medium border rounded-none transition-colors ${
                        feedbackType === 'bug'
                          ? 'bg-primary/10 border-primary/50 text-primary'
                          : 'bg-surface-3 border-border-subtle text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => setFeedbackType('bug')}
                    >
                      Report Bug
                    </button>
                    <button
                      type="button"
                      className={`flex-1 py-1 text-[10px] font-medium border rounded-none transition-colors ${
                        feedbackType === 'feature'
                          ? 'bg-primary/10 border-primary/50 text-primary'
                          : 'bg-surface-3 border-border-subtle text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => setFeedbackType('feature')}
                    >
                      Suggest Feature
                    </button>
                  </div>
                </div>

                {feedbackType === 'bug' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider block">
                        Severity
                      </label>
                      <select
                        value={bugSeverity}
                        onChange={(e) => setBugSeverity(e.target.value)}
                        className="w-full bg-surface-3 border border-border-subtle rounded-none p-1 text-[10px] focus-visible:outline-none font-semibold text-foreground"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider block">
                        Reproducibility
                      </label>
                      <select
                        value={bugReproducibility}
                        onChange={(e) => setBugReproducibility(e.target.value)}
                        className="w-full bg-surface-3 border border-border-subtle rounded-none p-1 text-[10px] focus-visible:outline-none font-semibold text-foreground"
                      >
                        <option value="always">Always</option>
                        <option value="sometimes">Sometimes</option>
                        <option value="rarely">Rarely</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider block">
                    Description
                  </label>
                  <textarea
                    rows={4}
                    placeholder={
                      feedbackType === 'bug'
                        ? 'Describe the steps to reproduce the bug...'
                        : 'Describe your proposal and the problem it solves...'
                    }
                    value={feedbackDescription}
                    onChange={(e) => setFeedbackDescription(e.target.value)}
                    className="w-full bg-surface-3 border border-border-subtle rounded-none p-2 text-[10px] text-foreground placeholder:text-muted-foreground/60 resize-none outline-none focus:border-primary/50"
                  />
                </div>

                <div className="bg-surface-3 border border-border-subtle/50 rounded-none p-2.5 space-y-1 text-[9px] text-muted-foreground">
                  <span className="font-semibold block text-primary">Note:</span>
                  Submitting copies masked diagnostics to your clipboard and redirects to the GitHub
                  issue page.
                </div>

                <Button
                  type="button"
                  size="sm"
                  className="w-full h-8 text-[10px] bg-primary hover:bg-primary/80 text-white font-semibold rounded-none"
                  onClick={handleSubmitFeedback}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Submit Feedback & Copy Diagnostics
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 5. Metrics Tab */}
        <TabsContent value="metrics" className="space-y-4 outline-none mt-0">
          <div className="bg-card border border-border-subtle rounded-none p-4 space-y-4 shadow-sm">
            <h3 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
              <Percent className="h-4 w-4 text-primary" />
              Runtime Durations & Performance Latency
            </h3>

            {metricsQuery.data ? (
              <div className="space-y-6">
                {/* Metric Cards Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-surface-3 border border-border-subtle rounded-none p-3">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                      Discovery Avg
                    </span>
                    <p className="text-lg font-bold text-foreground mt-1 font-mono">
                      {(metricsQuery.data.discoveryDurationAvg / 1000).toFixed(1)}s
                    </p>
                  </div>
                  <div className="bg-surface-3 border border-border-subtle rounded-none p-3">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                      Crawl Avg
                    </span>
                    <p className="text-lg font-bold text-foreground mt-1 font-mono">
                      {(metricsQuery.data.crawlerDurationAvg / 1000).toFixed(1)}s
                    </p>
                  </div>
                  <div className="bg-surface-3 border border-border-subtle rounded-none p-3">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                      Enrichment Avg
                    </span>
                    <p className="text-lg font-bold text-foreground mt-1 font-mono">
                      {(metricsQuery.data.enrichmentDurationAvg / 1000).toFixed(1)}s
                    </p>
                  </div>
                  <div className="bg-surface-3 border border-border-subtle rounded-none p-3">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                      Workflow Delay Avg
                    </span>
                    <p className="text-lg font-bold text-foreground mt-1 font-mono">
                      {(metricsQuery.data.queueWaitTimeAvg / 1000).toFixed(1)}s
                    </p>
                  </div>
                </div>

                {/* Simulated Chart of execution latency */}
                <div className="h-48 w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={[
                        { name: '1', discovery: 2000, crawler: 12000, enrichment: 1500 },
                        { name: '2', discovery: 2200, crawler: 14000, enrichment: 1700 },
                        { name: '3', discovery: 1800, crawler: 11000, enrichment: 1400 },
                        { name: '4', discovery: 2500, crawler: 15000, enrichment: 1800 },
                        { name: '5', discovery: 2100, crawler: 13000, enrichment: 1600 }
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                      <XAxis dataKey="name" stroke="#555" fontSize={9} />
                      <YAxis
                        stroke="#555"
                        fontSize={9}
                        label={{ value: 'Latency (ms)', angle: -90, position: 'insideLeft', fill: '#555' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0a0a0a',
                          borderColor: '#1f1f1f',
                          color: '#fff',
                          borderRadius: '0px'
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="discovery"
                        stroke="#ff8c00"
                        strokeWidth={1.5}
                        name="Discovery"
                      />
                      <Line
                        type="monotone"
                        dataKey="crawler"
                        stroke="#00bfff"
                        strokeWidth={1.5}
                        name="Crawler"
                      />
                      <Line
                        type="monotone"
                        dataKey="enrichment"
                        stroke="#da70d6"
                        strokeWidth={1.5}
                        name="Enrichment"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-[10px] italic py-6 text-center">
                Loading performance stats...
              </p>
            )}
          </div>
        </TabsContent>

        {/* 6. Error Console Tab */}
        <TabsContent value="errors" className="space-y-4 outline-none mt-0">
          <div className="bg-card border border-border-subtle rounded-none p-4 space-y-4 shadow-sm">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-danger animate-bounce" />
                Centralized SRE Error Console
              </h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-[10px] rounded-none"
                onClick={() => errorsQuery.refetch()}
              >
                Refresh Errors
              </Button>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {errorsQuery.data?.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 text-success opacity-60 mb-2" />
                  <p className="text-[10px] font-semibold">Zero failed jobs in Dead Letter queue</p>
                </div>
              ) : (
                errorsQuery.data?.map((job: any) => (
                  <div
                    key={job.id}
                    className="bg-surface-3 border border-danger/10 rounded-none p-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-[11px] font-mono">{job.type}</span>
                        <Badge className="bg-danger-muted text-danger border border-danger/20 text-[8px] font-bold rounded-none">
                          FAILED
                        </Badge>
                      </div>
                      <p className="text-danger text-[10px] font-mono select-text break-all leading-normal">
                        {job.error || 'Unknown runtime error exception.'}
                      </p>
                      <p className="text-[9px] text-muted-foreground font-mono">
                        Job ID: {job.id} | Priority: {job.priority}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] border-success/20 text-success hover:bg-success/10 rounded-none"
                        onClick={() =>
                          recoveryMutation.mutate({ action: 'retry-job', targetId: job.id })
                        }
                      >
                        <RotateCcw className="h-3 w-3 mr-1" /> Retry Job
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[10px] text-danger hover:bg-danger-muted rounded-none"
                        onClick={() =>
                          recoveryMutation.mutate({ action: 'cancel-job', targetId: job.id })
                        }
                      >
                        Cancel Job
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        {/* 7. SRE Recovery Tab */}
        <TabsContent value="recovery" className="space-y-4 outline-none mt-0">
          <div className="bg-card border border-border-subtle rounded-none p-4 space-y-4 shadow-sm">
            <h3 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
              <Wrench className="h-4 w-4 text-primary" />
              SRE Recovery Toolkit
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-surface-3 border border-border-subtle rounded-none p-3 flex justify-between items-center gap-4">
                <div>
                  <span className="font-bold text-foreground block text-[10px] uppercase tracking-wide">
                    Purge Backlog Task Queues
                  </span>
                  <p className="text-muted-foreground text-[10px] mt-0.5 font-medium">
                    Wipe all pending job queue and sync operations cache.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-danger border border-danger/20 hover:bg-danger-muted rounded-none text-[10px]"
                  onClick={() => recoveryMutation.mutate({ action: 'clear-queues' })}
                >
                  Clear Queues
                </Button>
              </div>

              <div className="bg-surface-3 border border-border-subtle rounded-none p-3 flex justify-between items-center gap-4">
                <div>
                  <span className="font-bold text-foreground block text-[10px] uppercase tracking-wide">
                    Clean Stale Running Workers
                  </span>
                  <p className="text-muted-foreground text-[10px] mt-0.5 font-medium">
                    Reconcile stuck jobs whose runner hosts have halted.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-warning border border-warning/20 hover:bg-warning-muted rounded-none text-[10px]"
                  onClick={() => recoveryMutation.mutate({ action: 'clean-orphaned' })}
                >
                  Clean Orphans
                </Button>
              </div>

              <div className="bg-surface-3 border border-border-subtle rounded-none p-3 flex justify-between items-center gap-4">
                <div>
                  <span className="font-bold text-foreground block text-[10px] uppercase tracking-wide">
                    Rebuild Local Cache
                  </span>
                  <p className="text-muted-foreground text-[10px] mt-0.5 font-medium">
                    Reset and rebuild local SQLite disposable cache directly from MongoDB.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-none text-[10px]"
                  onClick={() => recoveryMutation.mutate({ action: 'restore-backup' })}
                >
                  Restore SQLite
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 8. Developer Mode Tab */}
        {devModeActive && (
          <TabsContent value="developer" className="space-y-4 outline-none mt-0">
            <div className="bg-card border border-border-subtle rounded-none p-4 space-y-3 shadow-sm">
              <h3 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                <Terminal className="h-4 w-4 text-primary" />
                Raw Dev Engine Ticks & Signals Stream
              </h3>

              <div className="bg-surface-3 border border-border-subtle rounded-none p-3 font-mono text-[9px] text-muted-foreground space-y-1.5 max-h-[300px] overflow-y-auto">
                {devEvents.length === 0 ? (
                  <p className="italic text-muted-foreground py-6 text-center">
                    Listening for query logs, IPC requests, and worker heartbeats...
                  </p>
                ) : (
                  devEvents.map((evt: any, i: number) => (
                    <div
                      key={i}
                      className="flex justify-between items-start border-b border-border-subtle/30 pb-1"
                    >
                      <span className="text-slate-600 shrink-0 font-mono">[{evt.timestamp}]</span>
                      <Badge className="bg-primary/10 text-primary border border-primary/20 text-[8px] rounded-none">
                        {evt.type}
                      </Badge>
                      <p className="flex-1 text-foreground break-all ml-2">{evt.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
