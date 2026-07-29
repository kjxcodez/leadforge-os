import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '../../hooks/useWorkspace';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Activity,
  Clock,
  RefreshCw,
  XCircle,
  AlertCircle,
  CheckCircle,
  Play,
  RotateCcw,
  Search
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function QueueMonitor() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || '';
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('jobs');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Fetch scheduler jobs list
  const jobsQuery = useQuery({
    queryKey: ['scheduler_jobs', workspaceId],
    queryFn: async () => {
      return window.ipc.invoke('scheduler:jobs:list', { workspaceId });
    },
    enabled: !!workspaceId,
    refetchInterval: 5000, // Poll every 5 seconds for live monitor updates
  });

  // 2. Fetch campaign queues list
  const queueQuery = useQuery({
    queryKey: ['campaign_queues', workspaceId],
    queryFn: async () => {
      return window.ipc.invoke('scheduler:queue:list', { workspaceId });
    },
    enabled: !!workspaceId,
    refetchInterval: 5000,
  });

  // Mutations
  const cancelJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return window.ipc.invoke('scheduler:jobs:cancel', { workspaceId, jobId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduler_jobs', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['campaign_queues', workspaceId] });
    },
  });

  const retryJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return window.ipc.invoke('scheduler:jobs:resume', { workspaceId, jobId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduler_jobs', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['campaign_queues', workspaceId] });
    },
  });

  const allJobs = (jobsQuery.data || []) as any[];
  const queueData = (queueQuery.data || { jobs: [], waiting: [] }) as { jobs: any[]; waiting: any[] };

  // Filter out completed and cancelled jobs for the active list
  const activeJobs = allJobs.filter((job) =>
    ['queued', 'starting', 'running', 'retrying', 'paused'].includes(job.status)
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse text-[9px] px-1.5 py-0.5 font-bold">Running</Badge>;
      case 'queued':
      case 'starting':
        return <Badge className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-[9px] px-1.5 py-0.5 font-semibold">Queued</Badge>;
      case 'waiting':
        return <Badge className="bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 text-[9px] px-1.5 py-0.5 font-semibold">Waiting</Badge>;
      case 'paused':
        return <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] px-1.5 py-0.5 font-semibold">Paused</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] px-1.5 py-0.5 font-bold">Failed</Badge>;
      case 'cancelled':
        return <Badge className="bg-muted/10 text-muted-foreground border border-muted/20 text-[9px] px-1.5 py-0.5 font-semibold">Cancelled</Badge>;
      default:
        return <Badge className="bg-green-500/10 text-green-400 border border-green-500/20 text-[9px] px-1.5 py-0.5 font-bold">Completed</Badge>;
    }
  };

  const getJobName = (type: string) => {
    switch (type) {
      case 'scraper:maps':
        return 'Google Maps Scraper';
      case 'crawler:website':
        return 'Website Contact Crawler';
      case 'enrich:website':
        return 'Website Enricher';
      case 'enrich:linkedin':
        return 'LinkedIn Profile Enricher';
      case 'outreach:campaign':
        return 'Campaign Broadcast Dispatcher';
      case 'automation:workflow':
        return 'Automation Sequence Run';
      case 'outreach:imap-poll':
        return 'IMAP Reply Inbox Poller';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-4 text-xs font-sans">
      <div className="flex justify-between items-center pb-2 border-b border-border-subtle">
        <div>
          <h3 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
            <Activity className="h-4 w-4 text-accent" />
            Execution Monitor
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Inspect background tasks, scheduled sequence runs, and failure logs.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            jobsQuery.refetch();
            queueQuery.refetch();
          }}
          className="h-8 text-[10px] gap-1"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-sunken/40 p-0.5 border border-border-subtle rounded flex w-max gap-1">
          <TabsTrigger value="jobs" className="px-3 py-1 text-[11px] font-medium">
            Active Jobs ({activeJobs.length})
          </TabsTrigger>
          <TabsTrigger value="queue" className="px-3 py-1 text-[11px] font-medium">
            Outbound Queue ({queueData.jobs.length + queueData.waiting.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Active Scheduler Jobs Tab ───────────────────────────────────── */}
        <TabsContent value="jobs" className="mt-3">
          <div className="bg-card border border-border-subtle rounded-xl overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-sunken/50">
                <TableRow>
                  <TableHead className="py-2.5">Task / Job Type</TableHead>
                  <TableHead className="py-2.5">Status</TableHead>
                  <TableHead className="py-2.5">Progress</TableHead>
                  <TableHead className="py-2.5">Running Time</TableHead>
                  <TableHead className="py-2.5 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeJobs.map((job) => {
                  const runningTime = job.updatedAt
                    ? formatDistanceToNow(new Date(job.updatedAt))
                    : 'N/A';
                  return (
                    <TableRow key={job.id} className="hover:bg-sunken/10">
                      <TableCell className="font-semibold text-foreground py-2.5">
                        {getJobName(job.type)}
                        <span className="block text-[9px] text-muted-foreground font-mono mt-0.5">ID: {job.id}</span>
                      </TableCell>
                      <TableCell className="py-2.5">{getStatusBadge(job.status)}</TableCell>
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-sunken rounded-full h-1.5 overflow-hidden border border-border-subtle">
                            <div className="bg-accent h-1.5 rounded-full" style={{ width: `${job.progress || 0}%` }} />
                          </div>
                          <span className="font-mono text-[9px]">{job.progress || 0}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-muted-foreground font-mono">{runningTime} ago</TableCell>
                      <TableCell className="py-2.5 text-right">
                        {['running', 'queued', 'starting'].includes(job.status) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => cancelJobMutation.mutate(job.id)}
                            className="h-7 text-[10px] text-danger-text hover:bg-danger-bg hover:text-danger-text"
                          >
                            Cancel
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}

                {activeJobs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No active scheduler jobs are currently running.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Outbound Email Queue Tab ────────────────────────────────────── */}
        <TabsContent value="queue" className="mt-3 space-y-4">
          
          {/* Waiting/Scheduled Emails */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-accent" />
              Scheduled / Waiting Emails ({queueData.waiting.length})
            </h4>
            <div className="bg-card border border-border-subtle rounded-xl overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-sunken/30">
                  <TableRow>
                    <TableHead className="py-2">Contact</TableHead>
                    <TableHead className="py-2">Campaign</TableHead>
                    <TableHead className="py-2">Next Scheduled Send</TableHead>
                    <TableHead className="py-2">Emails Sent</TableHead>
                    <TableHead className="py-2">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queueData.waiting.map((wait) => {
                    const nextSend = wait.nextExecutionAt
                      ? formatDistanceToNow(new Date(wait.nextExecutionAt))
                      : 'N/A';
                    return (
                      <TableRow key={wait.id} className="hover:bg-sunken/10">
                        <TableCell className="py-2 font-medium">
                          {wait.firstName} {wait.lastName || ''}
                          <span className="block text-[9px] text-muted-foreground font-mono mt-0.5">{wait.email}</span>
                        </TableCell>
                        <TableCell className="py-2 text-muted-foreground">{wait.campaignName || '—'}</TableCell>
                        <TableCell className="py-2 text-foreground font-mono">in {nextSend}</TableCell>
                        <TableCell className="py-2 font-mono">{wait.emailsSent || 0}</TableCell>
                        <TableCell className="py-2">{getStatusBadge(wait.status)}</TableCell>
                      </TableRow>
                    );
                  })}

                  {queueData.waiting.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                        No emails are currently waiting in the schedule queue.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Queued, Retrying, Failed & Cancelled Email Jobs */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-accent" />
              Email Job Queue History ({queueData.jobs.length})
            </h4>
            <div className="bg-card border border-border-subtle rounded-xl overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-sunken/30">
                  <TableRow>
                    <TableHead className="py-2">Contact</TableHead>
                    <TableHead className="py-2">Campaign</TableHead>
                    <TableHead className="py-2">Status</TableHead>
                    <TableHead className="py-2">Attempts</TableHead>
                    <TableHead className="py-2">Errors / Logs</TableHead>
                    <TableHead className="py-2 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queueData.jobs.map((job) => (
                    <TableRow key={job.jobId} className="hover:bg-sunken/10">
                      <TableCell className="py-2 font-medium">
                        {job.firstName} {job.lastName || ''}
                        <span className="block text-[9px] text-muted-foreground font-mono mt-0.5">{job.email}</span>
                      </TableCell>
                      <TableCell className="py-2 text-muted-foreground">{job.campaignName || '—'}</TableCell>
                      <TableCell className="py-2">{getStatusBadge(job.status)}</TableCell>
                      <TableCell className="py-2 font-mono">{job.retryCount || 0} / 3</TableCell>
                      <TableCell className="py-2 text-red-400 font-mono text-[9px] max-w-xs truncate">
                        {job.status === 'failed' ? 'Max retries exhausted' : (job.status === 'cancelled' ? 'Job Cancelled' : '—')}
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        {['failed', 'cancelled'].includes(job.status) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => retryJobMutation.mutate(job.jobId)}
                            className="h-6 px-1.5 text-[9px] text-emerald-500 hover:bg-emerald-500/10 gap-0.5"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Retry
                          </Button>
                        )}
                        {['running', 'queued', 'retrying'].includes(job.status) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => cancelJobMutation.mutate(job.jobId)}
                            className="h-6 px-1.5 text-[9px] text-red-500 hover:bg-red-500/10"
                          >
                            Cancel
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}

                  {queueData.jobs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                        No email jobs in the queue.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
