import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '../hooks/useWorkspace';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Terminal,
  Database,
  RefreshCw,
  Server,
  Activity,
  Layers,
  Settings,
  HardDrive,
  FileText,
  AlertTriangle,
  CheckCircle2,
  ListTodo
} from 'lucide-react';

export default function DiagnosticsScreen() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || '';
  const queryClient = useQueryClient();
  
  const [liveLogs, setLiveLogs] = useState<any[]>([]);
  const [logFilter, setLogFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [isLiveActive, setIsLiveActive] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);

  // 1. Fetch system diagnostics data from main process
  const diagQuery = useQuery({
    queryKey: ['system_diagnostics', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      return window.ipc.invoke('system:diagnostics' as any, { workspaceId });
    },
    enabled: !!workspaceId,
    refetchInterval: 3000, // Refresh diagnostics metrics every 3 seconds
  });

  // 2. Setup real-time system log event listener
  useEffect(() => {
    if (!isLiveActive) return;

    const unsubscribe = window.ipc.on('system:log:event' as any, (logRecord: any) => {
      if (logRecord && logRecord.workspaceId === workspaceId) {
        setLiveLogs((prev) => [...prev.slice(-199), logRecord]); // Cap to 200 logs
      }
    });

    return () => {
      unsubscribe();
    };
  }, [workspaceId, isLiveActive]);

  // Scroll to bottom of log stream on updates
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [liveLogs]);

  // Seed initial logs from diagnostics query
  useEffect(() => {
    if (diagQuery.data?.logs && liveLogs.length === 0) {
      setLiveLogs(diagQuery.data.logs.slice().reverse());
    }
  }, [diagQuery.data, liveLogs.length]);

  if (!workspaceId) {
    return (
      <div className="p-8 text-center text-muted-foreground font-sans">
        Select a workspace to view developer diagnostics.
      </div>
    );
  }

  const diag = diagQuery.data || {};
  const tables = diag.tables || {};
  const migrations = diag.migrations || [];
  const jobs = diag.jobs || [];
  const syncQueue = diag.syncQueue || [];
  const storage = diag.storage || {};
  const workerStatus = diag.workerStatus || {};
  const ipcChannels = diag.ipcChannels || [];

  const filteredLogs = liveLogs.filter((log) => {
    if (logFilter === 'all') return true;
    return log.severity === logFilter;
  });

  const bytesToMb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2) + ' MB';

  return (
    <div className="space-y-6 text-xs font-sans h-full pr-1">
      {/* Header */}
      <div className="flex justify-between items-end border-b border-border-subtle pb-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
            <Terminal className="w-4 h-4 text-accent" />
            Developer Diagnostics
          </h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Real-time local-first system logs, database health monitoring, and IPC tracing.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLiveLogs([]);
              diagQuery.refetch();
            }}
            className="h-8 font-semibold gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Force Reload
          </Button>
        </div>
      </div>

      {/* Grid: Health Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Database Health Card */}
        <div className="bg-card border border-border-subtle p-4 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Database Integrity</span>
            <Database className="w-3.5 h-3.5 text-accent" />
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            {diag.dbHealth === 'ok' ? (
              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 font-bold uppercase py-0.5">
                HEALTHY
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 font-bold uppercase py-0.5">
                CORRUPT
              </Badge>
            )}
            <span className="text-foreground font-bold tracking-tight">PRAGMA OK</span>
          </div>
          <div className="text-[9px] text-muted-foreground mt-2">Integrity self-checks complete.</div>
        </div>

        {/* Disk Space usage */}
        <div className="bg-card border border-border-subtle p-4 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Local SQLite Size</span>
            <HardDrive className="w-3.5 h-3.5 text-accent" />
          </div>
          <div className="mt-3">
            <div className="text-sm font-bold text-foreground">
              {bytesToMb(storage.workspaceDbSize || 0)}
            </div>
            <div className="text-[9px] text-muted-foreground mt-1">
              Global DB: {bytesToMb(storage.globalDbSize || 0)}
            </div>
          </div>
          <div className="text-[9px] text-muted-foreground mt-2">UserData database footprint.</div>
        </div>

        {/* Worker scheduler statuses */}
        <div className="bg-card border border-border-subtle p-4 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Job Scheduler Workers</span>
            <Server className="w-3.5 h-3.5 text-accent" />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="text-sm font-bold text-foreground">
              {workerStatus.activeWorkersCount || 0} Active
            </div>
            {workerStatus.isRuntimeActive ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
            ) : (
              <span className="h-2 w-2 rounded-full bg-red-500"></span>
            )}
          </div>
          <div className="text-[9px] text-muted-foreground mt-2">
            {workerStatus.activeWorkersList?.length
              ? `Running: ${workerStatus.activeWorkersList.join(', ')}`
              : 'Scheduler idle, listening for tasks.'}
          </div>
        </div>

        {/* Pending synchronizations queue */}
        <div className="bg-card border border-border-subtle p-4 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Offline Sync Queue</span>
            <Activity className="w-3.5 h-3.5 text-accent" />
          </div>
          <div className="mt-3">
            <div className="text-sm font-bold text-foreground">
              {syncQueue.length} Mutations
            </div>
            <div className="text-[9px] text-muted-foreground mt-1">
              Offline edits waiting remote push
            </div>
          </div>
          <div className="text-[9px] text-muted-foreground mt-2">Push worker runs every 5 seconds.</div>
        </div>
      </div>

      {/* Grid: Diagnostics tables, migrations, IPC */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table Metrics */}
        <div className="bg-card border border-border-subtle rounded-xl p-4 space-y-3 shadow-sm lg:col-span-1">
          <h3 className="font-bold text-foreground uppercase tracking-wider text-[10px] flex items-center gap-1">
            <Database className="w-3.5 h-3.5 text-accent" />
            SQLite Local Tables
          </h3>
          <div className="divide-y divide-border-subtle/50 overflow-y-auto max-h-[220px] pr-1">
            {Object.keys(tables).length === 0 ? (
              <div className="py-4 text-center text-muted-foreground">No custom tables discovered.</div>
            ) : (
              Object.entries(tables).map(([tableName, rowCount]) => (
                <div key={tableName} className="py-2 flex justify-between items-center text-[11px]">
                  <span className="font-mono text-foreground font-semibold">{tableName}</span>
                  <span className="px-2 py-0.5 rounded-full bg-sunken font-bold text-accent">
                    {rowCount === -1 ? 'Error' : `${rowCount} rows`}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Migration Logs */}
        <div className="bg-card border border-border-subtle rounded-xl p-4 space-y-3 shadow-sm lg:col-span-1">
          <h3 className="font-bold text-foreground uppercase tracking-wider text-[10px] flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-accent" />
            Applied Migrations
          </h3>
          <div className="divide-y divide-border-subtle/50 overflow-y-auto max-h-[220px] pr-1">
            {migrations.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground">No schema migrations applied yet.</div>
            ) : (
              migrations.map((m: any) => (
                <div key={m.name} className="py-2.5 flex flex-col gap-0.5 text-[11px]">
                  <div className="flex justify-between items-center font-semibold">
                    <span className="text-foreground truncate pr-2">{m.name}</span>
                    <Badge variant="outline" className="text-[8px] bg-green-500/5 text-green-500 border-green-500/10">
                      SUCCESS
                    </Badge>
                  </div>
                  <span className="text-[9px] text-muted-foreground">
                    Applied: {new Date(m.runAt).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Registered IPC Channels */}
        <div className="bg-card border border-border-subtle rounded-xl p-4 space-y-3 shadow-sm lg:col-span-1">
          <h3 className="font-bold text-foreground uppercase tracking-wider text-[10px] flex items-center gap-1">
            <Settings className="w-3.5 h-3.5 text-accent" />
            Registered IPC Listeners
          </h3>
          <div className="overflow-y-auto max-h-[220px] pr-1 space-y-1.5 font-mono text-[9px] text-muted-foreground">
            {ipcChannels.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground">No custom IPC channels registered.</div>
            ) : (
              ipcChannels.sort().map((channel: string) => (
                <div key={channel} className="px-2 py-1 rounded bg-sunken/40 flex items-center gap-1.5 hover:text-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                  <span>{channel}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Sync Queue, Background Jobs & Tasks lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sync Queue Monitor */}
        <div className="bg-card border border-border-subtle rounded-xl p-4 space-y-3 shadow-sm">
          <h3 className="font-bold text-foreground uppercase tracking-wider text-[10px] flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-accent" />
              Sync Queue Queueing
            </span>
            <Badge variant="outline" className="bg-accent/10 text-accent font-bold">
              {syncQueue.length} Pending
            </Badge>
          </h3>
          <div className="overflow-y-auto max-h-[250px] border border-border-subtle/40 rounded-lg">
            {syncQueue.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No operations in sync queue.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-sunken text-[9px] font-bold text-muted-foreground uppercase border-b border-border-subtle tracking-wider">
                    <th className="px-3 py-2">EntityType</th>
                    <th className="px-3 py-2">Operation</th>
                    <th className="px-3 py-2">Entity ID</th>
                    <th className="px-3 py-2">Retries</th>
                    <th className="px-3 py-2">Last Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50 text-[10px]">
                  {syncQueue.map((item: any) => (
                    <tr key={item.id} className="hover:bg-sunken/30">
                      <td className="px-3 py-2 font-semibold text-foreground">{item.entityType}</td>
                      <td className="px-3 py-2">
                        <Badge
                          variant="outline"
                          className={`text-[8px] font-bold ${
                            item.operation === 'CREATE'
                              ? 'bg-green-500/10 text-green-500 border-green-500/10'
                              : item.operation === 'UPDATE'
                              ? 'bg-blue-500/10 text-blue-500 border-blue-500/10'
                              : 'bg-red-500/10 text-red-500 border-red-500/10'
                          }`}
                        >
                          {item.operation}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 font-mono text-[9px]">{item.entityId}</td>
                      <td className="px-3 py-2 font-bold">{item.retryCount}</td>
                      <td className="px-3 py-2 text-danger-text truncate max-w-[150px]">{item.lastError || 'None'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Background Jobs List */}
        <div className="bg-card border border-border-subtle rounded-xl p-4 space-y-3 shadow-sm">
          <h3 className="font-bold text-foreground uppercase tracking-wider text-[10px] flex items-center justify-between">
            <span className="flex items-center gap-1">
              <ListTodo className="w-3.5 h-3.5 text-accent" />
              Recent Background Scraper / Enrichment Jobs
            </span>
            <Badge variant="outline" className="bg-accent/10 text-accent font-bold">
              {jobs.length} total
            </Badge>
          </h3>
          <div className="overflow-y-auto max-h-[250px] border border-border-subtle/40 rounded-lg">
            {jobs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No background scheduler jobs run.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-sunken text-[9px] font-bold text-muted-foreground uppercase border-b border-border-subtle tracking-wider">
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Progress</th>
                    <th className="px-3 py-2">Priority</th>
                    <th className="px-3 py-2">Started</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50 text-[10px]">
                  {jobs.map((job: any) => (
                    <tr key={job.id} className="hover:bg-sunken/30">
                      <td className="px-3 py-2 font-mono text-accent">{job.type}</td>
                      <td className="px-3 py-2">
                        <Badge
                          variant="outline"
                          className={`text-[8px] font-bold uppercase ${
                            job.status === 'completed'
                              ? 'bg-green-500/10 text-green-500 border-green-500/10'
                              : job.status === 'running'
                              ? 'bg-blue-500/10 text-blue-500 border-blue-500/10'
                              : job.status === 'failed'
                              ? 'bg-red-500/10 text-red-500 border-red-500/10'
                              : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/10'
                          }`}
                        >
                          {job.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 font-semibold">
                        <div className="w-full bg-sunken rounded-full h-1.5 max-w-[60px] overflow-hidden flex">
                          <div
                            className="bg-accent h-1.5 rounded-full"
                            style={{ width: `${job.progress || 0}%` }}
                          ></div>
                        </div>
                        <span className="text-[8px] text-muted-foreground mt-0.5 block">{job.progress || 0}%</span>
                      </td>
                      <td className="px-3 py-2 font-bold">{job.priority}</td>
                      <td className="px-3 py-2 text-muted-foreground text-[9px]">{new Date(job.createdAt).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Structured Live logs view console */}
      <div className="bg-card border border-border-subtle rounded-xl p-4 space-y-3 shadow-sm">
        <div className="flex justify-between items-center border-b border-border-subtle pb-2">
          <h3 className="font-bold text-foreground uppercase tracking-wider text-[10px] flex items-center gap-1">
            <FileText className="w-3.5 h-3.5 text-accent" />
            Structured System logs (Live console)
          </h3>
          <div className="flex gap-2">
            {(['all', 'info', 'warn', 'error'] as const).map((sev) => (
              <Button
                key={sev}
                variant={logFilter === sev ? 'default' : 'outline'}
                size="icon"
                onClick={() => setLogFilter(sev)}
                className="px-2 py-0.5 text-[9px] font-semibold uppercase h-6 w-auto"
              >
                {sev}
              </Button>
            ))}
            <Button
              variant={isLiveActive ? 'default' : 'outline'}
              size="icon"
              onClick={() => setIsLiveActive(!isLiveActive)}
              className="px-2 py-0.5 text-[9px] font-semibold uppercase h-6 w-auto"
            >
              {isLiveActive ? 'Live ON' : 'Paused'}
            </Button>
          </div>
        </div>

        {/* Live log entries */}
        <div className="bg-black/90 font-mono text-[10px] text-green-400 p-4 rounded-lg h-[350px] overflow-y-auto space-y-1.5 shadow-inner select-text">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-neutral-600">No log events matches.</div>
          ) : (
            filteredLogs.map((log) => {
              let color = 'text-green-400';
              let bg = 'bg-green-500/10';
              let icon = <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />;
              
              if (log.severity === 'warn') {
                color = 'text-yellow-400';
                bg = 'bg-yellow-500/10';
                icon = <AlertTriangle className="w-3 h-3 text-yellow-400 shrink-0" />;
              } else if (log.severity === 'error') {
                color = 'text-red-400';
                bg = 'bg-red-500/10';
                icon = <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />;
              }

              return (
                <div key={log.id} className={`flex items-start gap-2 p-1.5 rounded ${bg} border border-transparent hover:border-neutral-800 transition-colors`}>
                  {icon}
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 font-bold">
                      <span className="text-neutral-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      <span className={color}>[{log.severity.toUpperCase()}]</span>
                      <span className="text-accent">{log.task}</span>
                      <span className="text-neutral-400">{log.message}</span>
                    </div>
                    {log.metadata && (
                      <pre className="text-neutral-500 text-[8px] bg-neutral-950 p-1.5 rounded overflow-x-auto border border-neutral-900 leading-normal max-h-40">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={logEndRef}></div>
        </div>
      </div>
    </div>
  );
}
