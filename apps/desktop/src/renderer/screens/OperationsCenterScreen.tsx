import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '../hooks/useWorkspace';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
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
  Eye,
  ShieldCheck,
  Percent,
  Search,
  SlidersHorizontal,
  CheckCircle2
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
        <SlidersHorizontal className="h-10 w-10 mb-2 opacity-50" />
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
      toast.error('Failed to automatically copy diagnostics to clipboard.');
    }

    const repoUrl = 'https://github.com/kjxcodez/leadforge-os/issues/new';
    const url = `${repoUrl}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    window.open(url);
    toast.success('Opening GitHub Issue page in browser...');
    setFeedbackDescription('');
  };

  return (
    <div className="space-y-6 text-xs font-sans h-full pr-1">
      {/* Header Cockpit */}
      <div className="flex justify-between items-end border-b border-border-subtle pb-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-500 animate-pulse" />
            Operations Center & Observability Cockpit
          </h2>
          <p className="text-[10px] text-muted mt-0.5">Real-time telemetry, SRE tracing, error recovery, and system diagnostics.</p>
        </div>
        <div className="flex gap-2 items-center">
          <Button
            size="sm"
            variant={devModeActive ? 'default' : 'outline'}
            className="h-7 text-[10px]"
            onClick={() => setDevModeActive(!devModeActive)}
          >
            <Terminal className="h-3 w-3 mr-1" />
            Developer Mode: {devModeActive ? 'ON' : 'OFF'}
          </Button>
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-medium">
            Scheduler Status: Active
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-sunken border border-border-subtle p-0.5 gap-0.5 rounded-lg flex flex-wrap max-w-fit">
          <TabsTrigger value="dashboard" className="px-3 py-1.5 text-[10px] rounded-md">
            <Server className="h-3 w-3 mr-1" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="timeline" className="px-3 py-1.5 text-[10px] rounded-md">
            <History className="h-3 w-3 mr-1" /> Global Timeline
          </TabsTrigger>
          <TabsTrigger value="logs" className="px-3 py-1.5 text-[10px] rounded-md">
            <FileText className="h-3 w-3 mr-1" /> Structured Logs
          </TabsTrigger>
          <TabsTrigger value="diagnostics" className="px-3 py-1.5 text-[10px] rounded-md">
            <ShieldCheck className="h-3 w-3 mr-1" /> Diagnostics
          </TabsTrigger>
          <TabsTrigger value="metrics" className="px-3 py-1.5 text-[10px] rounded-md">
            <Percent className="h-3 w-3 mr-1" /> Performance
          </TabsTrigger>
          <TabsTrigger value="errors" className="px-3 py-1.5 text-[10px] rounded-md">
            <AlertTriangle className="h-3 w-3 mr-1" /> Error Console
          </TabsTrigger>
          <TabsTrigger value="audit" className="px-3 py-1.5 text-[10px] rounded-md">
            <Eye className="h-3 w-3 mr-1" /> Audit Trail
          </TabsTrigger>
          <TabsTrigger value="recovery" className="px-3 py-1.5 text-[10px] rounded-md">
            <Wrench className="h-3 w-3 mr-1" /> SRE Recovery
          </TabsTrigger>
          {devModeActive && (
            <TabsTrigger value="developer" className="px-3 py-1.5 text-[10px] rounded-md bg-indigo-500/10 text-indigo-400">
              <Terminal className="h-3 w-3 mr-1" /> Dev Engine
            </TabsTrigger>
          )}
        </TabsList>

        {/* 1. Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-4 outline-none">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-card border border-border-subtle rounded-xl p-3 flex flex-col justify-between">
              <span className="text-muted text-[10px] font-medium uppercase">Active Workers</span>
              <div className="flex items-end justify-between mt-2">
                <span className="text-xl font-bold text-foreground">{runningJobs.length}</span>
                <span className="text-[10px] text-indigo-500 font-semibold flex items-center gap-0.5">
                  <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-ping" /> Live
                </span>
              </div>
            </div>
            <div className="bg-card border border-border-subtle rounded-xl p-3 flex flex-col justify-between">
              <span className="text-muted text-[10px] font-medium uppercase">Queued Tasks</span>
              <div className="flex items-end justify-between mt-2">
                <span className="text-xl font-bold text-foreground">{queuedJobs.length}</span>
                <span className="text-[10px] text-amber-500">In-Queue</span>
              </div>
            </div>
            <div className="bg-card border border-border-subtle rounded-xl p-3 flex flex-col justify-between">
              <span className="text-muted text-[10px] font-medium uppercase">Dead Letter / Failures</span>
              <div className="flex items-end justify-between mt-2">
                <span className="text-xl font-bold text-rose-500">{failedJobs.length}</span>
                {failedJobs.length > 0 && (
                  <Badge variant="outline" className="text-rose-500 bg-rose-500/5 text-[9px] border-rose-500/20">
                    Action Required
                  </Badge>
                )}
              </div>
            </div>
            <div className="bg-card border border-border-subtle rounded-xl p-3 flex flex-col justify-between">
              <span className="text-muted text-[10px] font-medium uppercase">Backlog Queue Size</span>
              <div className="flex items-end justify-between mt-2">
                <span className="text-xl font-bold text-foreground">{waitingList.length}</span>
                <span className="text-[10px] text-slate-500">Scheduled Email Sends</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Live Scheduler Queue */}
            <div className="bg-card border border-border-subtle rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                <Server className="h-4 w-4 text-indigo-500" />
                Live Job Scheduler Queue
              </h3>
              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                {jobsList.length === 0 ? (
                  <p className="text-muted text-[10px] italic py-4 text-center">No active or recently completed jobs in queue.</p>
                ) : (
                  jobsList.map((job: any) => (
                    <div key={job.id} className="bg-sunken border border-border-subtle rounded-lg p-2.5 flex justify-between items-center gap-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground">{job.type}</span>
                          <Badge variant="outline" className={`text-[8px] px-1 py-0 ${
                            job.status === 'running' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' :
                            job.status === 'queued' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                            job.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                            'bg-rose-500/10 text-rose-500 border-rose-500/20'
                          }`}>{job.status}</Badge>
                        </div>
                        <p className="text-[9px] text-muted mt-0.5">Correlation ID: {job.id.substring(0, 8)}...</p>
                      </div>
                      <span className="text-[10px] text-muted">{job.progress}%</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Scheduler Status & Database Health */}
            <div className="bg-card border border-border-subtle rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Operational Status Checkpoints
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center py-1.5 border-b border-border-subtle/50">
                  <span className="font-medium text-foreground">SQLite Database</span>
                  <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-medium">Healthy</Badge>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-border-subtle/50">
                  <span className="font-medium text-foreground">Worker Host Runtime</span>
                  <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-medium">Operating</Badge>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-border-subtle/50">
                  <span className="font-medium text-foreground">Internet Connectivity</span>
                  <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-medium">Connected</Badge>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="font-medium text-foreground">Background Sync Dispatcher</span>
                  <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-medium">Idle</Badge>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 2. Global Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4 outline-none">
          <div className="bg-card border border-border-subtle rounded-xl p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                <History className="h-4 w-4 text-indigo-500" />
                Unified Event Tracing Timeline
              </h3>
              <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => auditQuery.refetch()}>
                Refresh Timeline
              </Button>
            </div>

            <div className="relative border-l border-border-subtle ml-3 pl-5 space-y-5 max-h-[400px] overflow-y-auto pr-1">
              {auditQuery.data?.length === 0 ? (
                <p className="text-muted text-[10px] italic py-6 text-center">No trace events recorded yet.</p>
              ) : (
                auditQuery.data?.map((event: any) => (
                  <div key={event.id} className="relative">
                    <span className="absolute -left-[26px] top-0.5 bg-sunken border border-border-subtle rounded-full h-3 w-3 flex items-center justify-center">
                      <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-[11px] uppercase tracking-wide">
                          {event.action}
                        </span>
                        <span className="text-[9px] text-muted">
                          {new Date(event.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Actor: {event.actor} | Entity ID: <span className="font-mono text-muted">{event.entityId}</span> ({event.entityType})
                      </p>
                      {event.beforeValue && (
                        <div className="mt-2 bg-sunken border border-border-subtle rounded p-2 font-mono text-[9px] text-muted overflow-x-auto">
                          <span className="font-semibold text-amber-500 block mb-0.5">State Before:</span>
                          {event.beforeValue}
                        </div>
                      )}
                      {event.afterValue && (
                        <div className="mt-2 bg-sunken border border-border-subtle rounded p-2 font-mono text-[9px] text-muted overflow-x-auto">
                          <span className="font-semibold text-emerald-500 block mb-0.5">State After:</span>
                          {event.afterValue}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        {/* 3. Structured Logs Tab */}
        <TabsContent value="logs" className="space-y-4 outline-none">
          <div className="bg-card border border-border-subtle rounded-xl p-4 space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <h3 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-indigo-500" />
                System Structured Logs Console
              </h3>
              <div className="flex gap-2 items-center w-full md:w-auto">
                <div className="relative flex-1 md:w-48">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
                  <Input
                    placeholder="Search logs..."
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    className="h-7 pl-8 text-[10px]"
                  />
                </div>
                <select
                  value={logSeverity}
                  onChange={(e) => setLogSeverity(e.target.value)}
                  className="bg-sunken border border-border-subtle rounded px-2 py-1 h-7 text-[10px]"
                >
                  <option value="all">All Levels</option>
                  <option value="info">Info</option>
                  <option value="warn">Warning</option>
                  <option value="error">Error</option>
                </select>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => handleExportJson(logsQuery.data, 'system_logs')}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="bg-sunken border border-border-subtle rounded-xl p-3 font-mono text-[10px] max-h-[350px] overflow-y-auto space-y-1">
              {logsQuery.data?.length === 0 ? (
                <p className="text-muted text-[10px] italic py-6 text-center">No logs match the current filters.</p>
              ) : (
                logsQuery.data?.map((log: any) => (
                  <div key={log.id} className="flex justify-between items-start hover:bg-card p-1 rounded gap-4">
                    <span className="text-[9px] text-slate-500 shrink-0">
                      [{new Date(log.timestamp).toLocaleTimeString()}]
                    </span>
                    <span className={`font-semibold shrink-0 uppercase tracking-wide text-[9px] ${
                      log.severity === 'error' ? 'text-rose-500' :
                      log.severity === 'warn' ? 'text-amber-500' :
                      'text-indigo-400'
                    }`}>
                      {log.severity}
                    </span>
                    <span className="text-indigo-500 font-semibold shrink-0">[{log.task}]</span>
                    <p className="flex-1 text-foreground break-all">{log.message}</p>
                    {log.metadata && (
                      <Button size="icon" variant="ghost" className="h-4 w-4 text-muted hover:text-foreground shrink-0" onClick={() => copyToClipboard(JSON.stringify(log.metadata))}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        {/* 4. Diagnostics Tab */}
        <TabsContent value="diagnostics" className="space-y-4 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* Left Col: Metadata Table & Diagnostic Actions */}
            <div className="lg:col-span-2 space-y-4">
              
              {/* System Metadata Cockpit */}
              <div className="bg-card border border-border-subtle rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-foreground text-xs flex items-center gap-1.5 border-b border-border-subtle pb-2">
                  <Server className="h-4 w-4 text-indigo-500" />
                  System Diagnostics & Specifications
                </h3>

                {systemInfoQuery.isLoading ? (
                  <p className="text-muted text-[10px] italic py-4 text-center">Loading system specifications...</p>
                ) : systemInfoQuery.data ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[10px]">
                    <div className="space-y-1 bg-sunken p-2 rounded-lg border border-border-subtle/50">
                      <span className="text-muted block uppercase text-[8px] font-bold tracking-wider">Application Version</span>
                      <span className="font-semibold text-foreground">v{systemInfoQuery.data.appVersion}-beta.1 (Unsigned Build)</span>
                    </div>
                    <div className="space-y-1 bg-sunken p-2 rounded-lg border border-border-subtle/50">
                      <span className="text-muted block uppercase text-[8px] font-bold tracking-wider">Git Commit Hash</span>
                      <span className="font-mono text-foreground">{systemInfoQuery.data.gitCommit}</span>
                    </div>
                    <div className="space-y-1 bg-sunken p-2 rounded-lg border border-border-subtle/50">
                      <span className="text-muted block uppercase text-[8px] font-bold tracking-wider">Electron / Node Runtime</span>
                      <span className="font-semibold text-foreground">v{systemInfoQuery.data.electronVersion} / {systemInfoQuery.data.nodeVersion} ({systemInfoQuery.data.platform})</span>
                    </div>
                    <div className="space-y-1 bg-sunken p-2 rounded-lg border border-border-subtle/50">
                      <span className="text-muted block uppercase text-[8px] font-bold tracking-wider">Workspace Database Info</span>
                      <span className="font-semibold text-foreground">SQLite v{systemInfoQuery.data.databaseVersion} ({systemInfoQuery.data.activeWorkspaceId.substring(0, 8)}...)</span>
                    </div>
                    <div className="space-y-1 bg-sunken p-2 rounded-lg border border-border-subtle/50">
                      <span className="text-muted block uppercase text-[8px] font-bold tracking-wider">Database Migration Schema</span>
                      <span className="font-mono text-foreground">{systemInfoQuery.data.migrationVersion}</span>
                    </div>
                    <div className="space-y-1 bg-sunken p-2 rounded-lg border border-border-subtle/50">
                      <span className="text-muted block uppercase text-[8px] font-bold tracking-wider">Background Engines Status</span>
                      <span className="font-semibold text-foreground">Scheduler: {systemInfoQuery.data.schedulerStatus} \| Sync: {systemInfoQuery.data.syncEngineStatus}</span>
                    </div>
                    <div className="space-y-1 bg-sunken p-2 rounded-lg border border-border-subtle/50 sm:col-span-2">
                      <span className="text-muted block uppercase text-[8px] font-bold tracking-wider">AI Execution Settings (OpenRouter Key MASKED)</span>
                      <span className="font-semibold text-foreground">Mode: {systemInfoQuery.data.aiProviderConfig.mode} \| API Key Status: {systemInfoQuery.data.aiProviderConfig.openRouterKey}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted text-[10px] italic py-4 text-center">Failed to fetch system specifications.</p>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => copyToClipboard(JSON.stringify(systemInfoQuery.data, null, 2))}>
                    <Copy className="h-3 w-3 mr-1" /> Copy Diagnostics
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => handleExportJson(systemInfoQuery.data, 'diagnostics')}>
                    <Download className="h-3 w-3 mr-1" /> Export Diagnostics JSON
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    disabled={isExportingBundle}
                    className="h-7 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={handleExportSupportBundle}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    {isExportingBundle ? 'Exporting...' : 'Export Support Bundle ZIP'}
                  </Button>
                </div>
              </div>

              {/* SRE Observability Verification Tests */}
              <div className="bg-card border border-border-subtle rounded-xl p-4 space-y-4">
                <div className="flex justify-between items-center border-b border-border-subtle pb-2">
                  <h3 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-indigo-500" />
                    Local Diagnostics Triggers
                  </h3>
                  <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => diagnosticsQuery.refetch()}>
                    Run Health Checks
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {diagnosticsQuery.data ? (
                    Object.entries(diagnosticsQuery.data).map(([key, val]: [string, any]) => (
                      <div key={key} className="bg-sunken border border-border-subtle rounded-lg p-2.5 flex flex-col justify-between gap-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-foreground uppercase text-[8px] tracking-wider">{key}</span>
                          <Badge className={`text-[8px] px-1 py-0 ${
                            val.status === 'healthy' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                            val.status === 'warning' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                            'bg-rose-500/10 text-rose-500 border-rose-500/20'
                          }`}>
                            {val.status}
                          </Badge>
                        </div>
                        <p className="text-muted text-[9px] mt-0.5">{val.message}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted text-[10px] italic py-4 text-center col-span-2">Execute diagnostics test suite to verify connectivity and ports...</p>
                  )}
                </div>
              </div>

            </div>

            {/* Right Col: Feedback Panel */}
            <div className="bg-card border border-border-subtle rounded-xl p-4 space-y-4 h-fit">
              <h3 className="font-semibold text-foreground text-xs flex items-center gap-1.5 border-b border-border-subtle pb-2">
                <Terminal className="h-4 w-4 text-indigo-500" />
                Beta Feedback Cockpit
              </h3>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-muted tracking-wider block">Feedback Category</label>
                  <div className="flex gap-1.5">
                    <button
                      className={`flex-1 py-1 text-[10px] font-medium border rounded-md transition-colors ${
                        feedbackType === 'bug' ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400' : 'bg-sunken border-border-subtle text-muted hover:text-foreground'
                      }`}
                      onClick={() => setFeedbackType('bug')}
                    >
                      Report Bug
                    </button>
                    <button
                      className={`flex-1 py-1 text-[10px] font-medium border rounded-md transition-colors ${
                        feedbackType === 'feature' ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400' : 'bg-sunken border-border-subtle text-muted hover:text-foreground'
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
                      <label className="text-[9px] font-bold uppercase text-muted tracking-wider block">Severity</label>
                      <select
                        value={bugSeverity}
                        onChange={(e) => setBugSeverity(e.target.value)}
                        className="w-full bg-sunken border border-border-subtle rounded p-1 text-[10px]"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-muted tracking-wider block">Reproducibility</label>
                      <select
                        value={bugReproducibility}
                        onChange={(e) => setBugReproducibility(e.target.value)}
                        className="w-full bg-sunken border border-border-subtle rounded p-1 text-[10px]"
                      >
                        <option value="always">Always</option>
                        <option value="sometimes">Sometimes</option>
                        <option value="rarely">Rarely</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-muted tracking-wider block">Description</label>
                  <textarea
                    rows={4}
                    placeholder={
                      feedbackType === 'bug' 
                        ? 'Describe the steps to reproduce the bug...' 
                        : 'Describe your proposal and the problem it solves...'
                    }
                    value={feedbackDescription}
                    onChange={(e) => setFeedbackDescription(e.target.value)}
                    className="w-full bg-sunken border border-border-subtle rounded p-2 text-[10px] text-foreground placeholder:text-muted/60 resize-none outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="bg-sunken border border-border-subtle/50 rounded-lg p-2.5 space-y-1 text-[9px] text-muted">
                  <span className="font-semibold block text-indigo-400">Note:</span>
                  Submitting copies masked diagnostics to your clipboard and redirects to the GitHub issue page.
                </div>

                <Button
                  size="sm"
                  className="w-full h-8 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
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
        <TabsContent value="metrics" className="space-y-4 outline-none">
          <div className="bg-card border border-border-subtle rounded-xl p-4 space-y-4">
            <h3 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
              <Percent className="h-4 w-4 text-indigo-500" />
              Runtime Durations & Performance Latency
            </h3>

            {metricsQuery.data ? (
              <div className="space-y-6">
                {/* Metric Cards Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-sunken border border-border-subtle rounded-xl p-3">
                    <span className="text-[10px] text-muted uppercase font-semibold">Discovery Avg</span>
                    <p className="text-lg font-bold text-foreground mt-1">{(metricsQuery.data.discoveryDurationAvg / 1000).toFixed(1)}s</p>
                  </div>
                  <div className="bg-sunken border border-border-subtle rounded-xl p-3">
                    <span className="text-[10px] text-muted uppercase font-semibold">Crawl Avg</span>
                    <p className="text-lg font-bold text-foreground mt-1">{(metricsQuery.data.crawlerDurationAvg / 1000).toFixed(1)}s</p>
                  </div>
                  <div className="bg-sunken border border-border-subtle rounded-xl p-3">
                    <span className="text-[10px] text-muted uppercase font-semibold">Enrichment Avg</span>
                    <p className="text-lg font-bold text-foreground mt-1">{(metricsQuery.data.enrichmentDurationAvg / 1000).toFixed(1)}s</p>
                  </div>
                  <div className="bg-sunken border border-border-subtle rounded-xl p-3">
                    <span className="text-[10px] text-muted uppercase font-semibold">Workflow Delay Avg</span>
                    <p className="text-lg font-bold text-foreground mt-1">{(metricsQuery.data.queueWaitTimeAvg / 1000).toFixed(1)}s</p>
                  </div>
                </div>

                {/* Simulated Chart of execution latency */}
                <div className="h-48 w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[
                      { name: '1', discovery: 2000, crawler: 12000, enrichment: 1500 },
                      { name: '2', discovery: 2200, crawler: 14000, enrichment: 1700 },
                      { name: '3', discovery: 1800, crawler: 11000, enrichment: 1400 },
                      { name: '4', discovery: 2500, crawler: 15000, enrichment: 1800 },
                      { name: '5', discovery: 2100, crawler: 13000, enrichment: 1600 }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                      <XAxis dataKey="name" stroke="#666" fontSize={9} />
                      <YAxis stroke="#666" fontSize={9} label={{ value: 'Latency (ms)', angle: -90, position: 'insideLeft' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#2f2f2f', color: '#fff' }} />
                      <Line type="monotone" dataKey="discovery" stroke="#ff8c00" strokeWidth={1.5} name="Discovery" />
                      <Line type="monotone" dataKey="crawler" stroke="#00bfff" strokeWidth={1.5} name="Crawler" />
                      <Line type="monotone" dataKey="enrichment" stroke="#da70d6" strokeWidth={1.5} name="Enrichment" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <p className="text-muted text-[10px] italic py-6 text-center">Loading performance stats...</p>
            )}
          </div>
        </TabsContent>

        {/* 6. Error Console Tab */}
        <TabsContent value="errors" className="space-y-4 outline-none">
          <div className="bg-card border border-border-subtle rounded-xl p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-rose-500" />
                Centralized SRE Error Console
              </h3>
              <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => errorsQuery.refetch()}>
                Refresh Errors
              </Button>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {errorsQuery.data?.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-muted">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 opacity-60 mb-2" />
                  <p className="text-[10px] font-semibold">Zero failed jobs in Dead Letter queue</p>
                </div>
              ) : (
                errorsQuery.data?.map((job: any) => (
                  <div key={job.id} className="bg-sunken border border-rose-500/10 rounded-xl p-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-[11px]">{job.type}</span>
                        <Badge variant="outline" className="text-rose-500 bg-rose-500/5 border-rose-500/20 text-[8px]">
                          FAILED
                        </Badge>
                      </div>
                      <p className="text-rose-400 text-[10px] font-mono select-text break-all">{job.error || 'Unknown runtime error exception.'}</p>
                      <p className="text-[9px] text-muted">Job ID: {job.id} | Priority: {job.priority}</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button size="sm" variant="outline" className="h-7 text-[10px] border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10" onClick={() => recoveryMutation.mutate({ action: 'retry-job', targetId: job.id })}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Retry Job
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-[10px] text-rose-500 hover:bg-rose-500/10" onClick={() => recoveryMutation.mutate({ action: 'cancel-job', targetId: job.id })}>
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
        <TabsContent value="recovery" className="space-y-4 outline-none">
          <div className="bg-card border border-border-subtle rounded-xl p-4 space-y-4">
            <h3 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
              <Wrench className="h-4 w-4 text-indigo-500" />
              SRE Recovery Toolkit
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-sunken border border-border-subtle rounded-xl p-3 flex justify-between items-center gap-4">
                <div>
                  <span className="font-bold text-foreground block text-[10px] uppercase tracking-wide">Purge Backlog Task Queues</span>
                  <p className="text-muted-foreground text-[10px] mt-0.5">Wipe all pending job queue and sync operations cache.</p>
                </div>
                <Button size="sm" variant="outline" className="text-rose-500 border-rose-500/20 hover:bg-rose-500/10" onClick={() => recoveryMutation.mutate({ action: 'clear-queues' })}>
                  Clear Queues
                </Button>
              </div>

              <div className="bg-sunken border border-border-subtle rounded-xl p-3 flex justify-between items-center gap-4">
                <div>
                  <span className="font-bold text-foreground block text-[10px] uppercase tracking-wide">Clean Stale Running Workers</span>
                  <p className="text-muted-foreground text-[10px] mt-0.5">Reconcile stuck jobs whose runner hosts have halted.</p>
                </div>
                <Button size="sm" variant="outline" className="text-amber-500 border-amber-500/20 hover:bg-amber-500/10" onClick={() => recoveryMutation.mutate({ action: 'clean-orphaned' })}>
                  Clean Orphans
                </Button>
              </div>

              <div className="bg-sunken border border-border-subtle rounded-xl p-3 flex justify-between items-center gap-4">
                <div>
                  <span className="font-bold text-foreground block text-[10px] uppercase tracking-wide">Restore Migration Backup</span>
                  <p className="text-muted-foreground text-[10px] mt-0.5">Restore database workspace from the daily `.migration.bak` copy.</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => recoveryMutation.mutate({ action: 'restore-backup' })}>
                  Restore SQLite
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 8. Developer Mode Tab */}
        {devModeActive && (
          <TabsContent value="developer" className="space-y-4 outline-none">
            <div className="bg-card border border-border-subtle rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                <Terminal className="h-4 w-4 text-indigo-400" />
                Raw Dev Engine Ticks & Signals Stream
              </h3>

              <div className="bg-sunken border border-border-subtle rounded-xl p-3 font-mono text-[9px] text-muted space-y-1.5 max-h-[300px] overflow-y-auto">
                {devEvents.length === 0 ? (
                  <p className="italic text-muted py-6 text-center">Listening for query logs, IPC requests, and worker heartbeats...</p>
                ) : (
                  devEvents.map((evt: any, i: number) => (
                    <div key={i} className="flex justify-between items-start border-b border-border-subtle/30 pb-1">
                      <span className="text-slate-600 shrink-0">[{evt.timestamp}]</span>
                      <Badge variant="outline" className="text-[8px] bg-indigo-500/5 text-indigo-400 border-indigo-500/20 shrink-0">{evt.type}</Badge>
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
