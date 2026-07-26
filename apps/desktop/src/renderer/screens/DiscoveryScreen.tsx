import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '../hooks/useWorkspace';
import {
  SyncCompanyRepository,
  SyncContactRepository
} from '../repositories/sync';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Compass,
  CheckCircle,
  Plus,
  RefreshCw,
  Sparkles,
  Globe,
  Phone,
  Mail,
  ChevronDown,
  ChevronRight,
  Search,
  Layers,
  BarChart3,
  Activity,
} from 'lucide-react';

/**
 * DiscoveryScreen — lead discovery, job management, and results view.
 *
 * Layout: Results for the selected job are shown FIRST (above the fold).
 * The job queue is below, with crawler:website child jobs collapsed into
 * a summary count — not shown as individual rows.
 */
export default function DiscoveryScreen() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || '';
  const queryClient = useQueryClient();

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [jobQueueCollapsed, setJobQueueCollapsed] = useState(false);

  const [jobName, setJobName] = useState('');
  const [jobQuery, setJobQuery] = useState('');
  const [maxResults, setMaxResults] = useState(20);

  const jobsQuery = useQuery({
    queryKey: ['scheduler_jobs', 'list', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      return window.ipc.invoke('scheduler:jobs:list', { workspaceId });
    },
    enabled: !!workspaceId,
    refetchInterval: 1500,
  });

  const companiesQuery = useQuery({
    queryKey: ['companies', 'list', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      return SyncCompanyRepository.listAndSync(workspaceId);
    },
    enabled: !!workspaceId,
    refetchInterval: 2000,
  });

  const contactsQuery = useQuery({
    queryKey: ['contacts', 'list', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      return SyncContactRepository.listAndSync(workspaceId);
    },
    enabled: !!workspaceId,
    refetchInterval: 2000,
  });

  const createJobMutation = useMutation({
    mutationFn: async (payload: { name: string; query: string; maxResults: number }) => {
      return window.ipc.invoke('scheduler:jobs:submit', {
        workspaceId,
        type: 'scraper:maps',
        payload: { name: payload.name, query: payload.query, maxResults: payload.maxResults },
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['scheduler_jobs', 'list', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['companies', 'list', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['contacts', 'list', workspaceId] });
      setCreateOpen(false);
      setJobName('');
      setJobQuery('');
      setMaxResults(20);
      if (data?.id) setSelectedJobId(data.id);
    },
  });

  const enrichCompanyMutation = useMutation({
    mutationFn: async (payload: { companyId: string; website: string }) => {
      return window.ipc.invoke('scheduler:jobs:submit', {
        workspaceId,
        type: 'crawler:website',
        payload: { companyId: payload.companyId, website: payload.website, maxDepth: 2, maxPages: 10 },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduler_jobs', 'list', workspaceId] });
    },
  });

  const cancelJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return window.ipc.invoke('scheduler:jobs:cancel', { workspaceId, jobId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduler_jobs', 'list', workspaceId] });
    },
  });

  const handleCreateJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobName.trim() || !jobQuery.trim()) return;
    createJobMutation.mutate({ name: jobName, query: jobQuery, maxResults });
  };

  const allJobs = (jobsQuery.data || []) as any[];
  const existingCompanies = (companiesQuery.data || []) as any[];
  const existingContacts = (contactsQuery.data || []) as any[];

  const parentJobs = allJobs.filter((j) => j.type !== 'crawler:website');
  const crawlerJobs = allJobs.filter((j) => j.type === 'crawler:website');
  const runningCrawlers = crawlerJobs.filter((j) => ['running', 'queued', 'retrying'].includes(j.status)).length;
  const completedCrawlers = crawlerJobs.filter((j) => j.status === 'completed').length;

  const selectedJob = allJobs.find((j) => j.id === selectedJobId);
  const selectedJobPayload = selectedJob ? JSON.parse(selectedJob.payload || '{}') : {};
  const selectedQuery = (selectedJobPayload.query || '').toLowerCase().trim();

  const results = existingCompanies.filter((c) => {
    if (!selectedQuery) return true;
    const blob = `${c.name || ''} ${c.domain || ''} ${c.website || ''} ${c.location || ''}`.toLowerCase();
    if (blob.includes(selectedQuery)) return true;
    const words = selectedQuery.split(/\s+/).filter((w: string) => w.length > 2);
    if (words.length === 0) return true;
    return words.some((word: string) => {
      const stem = word.replace(/(ures|ure|s|es)$/i, '');
      return blob.includes(word) || (stem.length >= 3 && blob.includes(stem));
    });
  });

  const runningJobs = allJobs.filter((j) => ['running', 'queued', 'retrying'].includes(j.status)).length;

  const statusColor = (status: string) => {
    if (status === 'completed') return 'bg-green-500/10 text-green-500 border-green-500/20';
    if (status === 'running') return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    if (status === 'retrying') return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    if (status === 'cancelled' || status === 'failed') return 'bg-red-500/10 text-red-500 border-red-500/20';
    return 'bg-muted/10 text-muted-foreground border-muted/20';
  };

  return (
    <div className="flex flex-col gap-5 text-xs font-sans h-full overflow-y-auto pr-1">

      {/* Header */}
      <div className="flex flex-wrap justify-between items-end gap-3 border-b border-border-subtle pb-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Discovery Platform</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Scrape Google Maps leads, enrich contacts, and import directly into your CRM.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm" className="h-8 font-semibold gap-1.5 shrink-0">
          <Plus className="w-3.5 h-3.5" />
          New Discovery Run
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Discovery Jobs', value: parentJobs.length, Icon: Search, color: 'text-accent' },
          { label: 'Active Jobs', value: runningJobs, Icon: Activity, color: 'text-blue-400' },
          { label: 'Companies Found', value: existingCompanies.length, Icon: Layers, color: 'text-emerald-400' },
          {
            label: 'Site Crawlers',
            value: runningCrawlers > 0 ? `${runningCrawlers} active` : `${completedCrawlers} done`,
            Icon: Globe,
            color: 'text-violet-400',
          },
        ].map((w, i) => (
          <div key={i} className="bg-card border border-border-subtle rounded-xl p-3 flex items-start gap-2.5">
            <div className={`mt-0.5 ${w.color}`}>
              <w.Icon className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-bold text-foreground leading-tight">{w.value}</div>
              <span className="text-[9px] text-muted-foreground uppercase tracking-wide block">{w.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* RESULTS PANEL — shown first so you don't have to scroll */}
      {selectedJobId && (
        <div className="bg-card border border-border-subtle rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-border-subtle flex flex-wrap gap-2 justify-between items-center bg-accent/5">
            <h3 className="font-bold text-foreground uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-accent" />
              Results —{' '}
              <span className="font-mono text-accent normal-case">{selectedQuery || 'All companies'}</span>
              <Badge variant="outline" className="ml-1 text-[9px] h-4 px-1.5 border-accent/30 text-accent">
                {results.length}
              </Badge>
            </h3>
            <div className="flex items-center gap-2">
              {selectedJob?.status === 'running' && (
                <span className="text-[9px] text-blue-400 flex items-center gap-1 animate-pulse">
                  <Activity className="w-3 h-3" /> Scraping live...
                </span>
              )}
              <Button variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground" onClick={() => setSelectedJobId(null)}>
                ✕ Dismiss
              </Button>
            </div>
          </div>

          {companiesQuery.isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {selectedJob?.status === 'running'
                ? 'Scraper is running — results will appear here...'
                : 'No leads found for this query.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[640px]">
                <thead>
                  <tr className="bg-sunken border-b border-border-subtle text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                    <th className="px-4 py-2.5">Company</th>
                    <th className="px-4 py-2.5">Website</th>
                    <th className="px-4 py-2.5">Phone</th>
                    <th className="px-4 py-2.5">Location</th>
                    <th className="px-4 py-2.5">Contacts / Emails</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50">
                  {results.map((res) => {
                    const companyContacts = existingContacts.filter((ct) => ct.companyId === res.id);
                    const emailContacts = companyContacts.filter((ct) => ct.email);
                    const primaryEmail = emailContacts[0]?.email;

                    return (
                      <tr key={res.id} className="hover:bg-sunken/10 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground leading-snug">{res.name}</div>
                          {res.rating != null && (
                            <span className="text-[9px] text-amber-400">★ {res.rating}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 max-w-[160px]">
                          {res.website ? (
                            <a
                              href={res.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-accent hover:underline truncate block text-[10px]"
                            >
                              {res.domain || res.website}
                            </a>
                          ) : (
                            <span className="opacity-40">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {res.phone || <span className="opacity-40">—</span>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[180px]">
                          <span className="truncate block">{res.location || <span className="opacity-40">—</span>}</span>
                        </td>
                        <td className="px-4 py-3">
                          {emailContacts.length > 0 ? (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 font-bold text-[9px]">
                              <Mail className="w-2.5 h-2.5 mr-1" />
                              {emailContacts.length} email{emailContacts.length > 1 ? 's' : ''} · {primaryEmail}
                            </Badge>
                          ) : companyContacts.length > 0 ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-bold text-[9px]">
                              <Phone className="w-2.5 h-2.5 mr-1" />
                              Phone saved
                            </Badge>
                          ) : (
                            <span className="opacity-40">No contacts yet</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {res.website && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => enrichCompanyMutation.mutate({ companyId: res.id, website: res.website })}
                              disabled={enrichCompanyMutation.isPending}
                              className="h-6 text-[10px] gap-1 font-semibold border-accent/30 text-accent hover:bg-accent/10"
                            >
                              <Sparkles className="w-3 h-3" />
                              Enrich
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* JOB QUEUE — collapsible, crawler:website collapsed into a count */}
      <div className="bg-card border border-border-subtle rounded-xl overflow-hidden shadow-sm">
        <div
          className="px-4 py-3 border-b border-border-subtle flex items-center justify-between cursor-pointer hover:bg-sunken/20 transition-colors"
          onClick={() => setJobQueueCollapsed((v) => !v)}
        >
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-foreground uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
              Job Queue
            </h3>
            {runningJobs > 0 && (
              <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse">
                {runningJobs} active
              </Badge>
            )}
            {crawlerJobs.length > 0 && (
              <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-muted-foreground">
                +{crawlerJobs.length} crawler{crawlerJobs.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); jobsQuery.refetch(); }}
              className="w-6 h-6 p-0 text-muted-foreground"
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
            {jobQueueCollapsed
              ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            }
          </div>
        </div>

        {!jobQueueCollapsed && (
          <>
            {parentJobs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No discovery searches launched yet. Click <strong>"New Discovery Run"</strong> to begin.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[560px]">
                  <thead>
                    <tr className="bg-sunken/40 text-[9px] font-bold text-muted-foreground uppercase border-b border-border-subtle tracking-wider">
                      <th className="px-4 py-2.5">Job Name</th>
                      <th className="px-4 py-2.5">Query</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5 w-40">Progress</th>
                      <th className="px-4 py-2.5">Crawlers</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/50">
                    {parentJobs.map((job) => {
                      const isSelected = selectedJobId === job.id;
                      const payloadObj = JSON.parse(job.payload || '{}');
                      const displayName = payloadObj.name || job.type;
                      const queryStr = payloadObj.query || '';
                      const limitStr = payloadObj.maxResults ? `${payloadObj.maxResults} leads` : '';
                      const isRunnable = ['queued', 'running', 'retrying'].includes(job.status);

                      return (
                        <tr
                          key={job.id}
                          onClick={() => setSelectedJobId(isSelected ? null : job.id)}
                          className={`hover:bg-sunken/30 cursor-pointer transition-colors ${isSelected ? 'bg-accent/5' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <div className="font-semibold text-foreground">{displayName}</div>
                            {limitStr && <div className="text-[9px] text-muted-foreground">· {limitStr}</div>}
                          </td>
                          <td className="px-4 py-3 font-mono text-accent text-[10px]">{queryStr}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={`text-[9px] font-bold uppercase ${statusColor(job.status)}`}>
                              {job.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 w-44">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-sunken rounded-full h-1.5 overflow-hidden border border-border-subtle">
                                <div className="bg-accent h-full transition-all duration-300" style={{ width: `${job.progress || 0}%` }} />
                              </div>
                              <span className="font-mono text-[10px] text-muted-foreground w-8 shrink-0">{job.progress || 0}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-[10px]">
                            {runningCrawlers > 0
                              ? <span className="text-blue-400 animate-pulse">{runningCrawlers} crawling</span>
                              : completedCrawlers > 0
                              ? <span className="text-emerald-400">{completedCrawlers} done</span>
                              : <span className="opacity-40">—</span>
                            }
                          </td>
                          <td className="px-4 py-3 text-right space-x-2">
                            {isRunnable ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); cancelJobMutation.mutate(job.id); }}
                                disabled={cancelJobMutation.isPending}
                                className="h-6 text-[10px] text-red-500 hover:text-white hover:bg-red-500 border-red-500/25"
                              >
                                Cancel
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-6 text-[10px] gap-1 ${isSelected ? 'text-accent' : ''}`}
                                onClick={(e) => { e.stopPropagation(); setSelectedJobId(isSelected ? null : job.id); }}
                              >
                                {isSelected ? <CheckCircle className="w-3 h-3" /> : null}
                                {isSelected ? 'Showing' : 'View Results'}
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* CREATION MODAL */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-accent" />
              Launch Discovery Run
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateJob} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="jobName" className="text-xs font-semibold">Run Name</Label>
              <Input id="jobName" placeholder="Q4 HVAC Leads — Miami" value={jobName} onChange={(e) => setJobName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="jobQuery" className="text-xs font-semibold">Google Maps Search Query</Label>
              <Input id="jobQuery" placeholder="HVAC Contractors New York" value={jobQuery} onChange={(e) => setJobQuery(e.target.value)} required />
              <p className="text-[10px] text-muted-foreground">Enter a keyword query exactly as you would type it into Google Maps.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxResults" className="text-xs font-semibold flex items-center justify-between">
                <span>Max Leads to Scrape</span>
                <span className="font-mono text-accent text-sm">{maxResults}</span>
              </Label>
              <input
                id="maxResults"
                type="range"
                min={5}
                max={100}
                step={5}
                value={maxResults}
                onChange={(e) => setMaxResults(Number(e.target.value))}
                className="w-full h-1.5 rounded-full cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-muted-foreground">
                <span>5 (fast)</span>
                <span>20 (default)</span>
                <span>100 (deep)</span>
              </div>
            </div>
            <div className="bg-sunken/40 border border-border-subtle rounded-lg p-3 text-[10px] text-muted-foreground space-y-1">
              <div className="font-semibold text-foreground">What happens next</div>
              <div>① Google Maps is scraped for up to <strong className="text-foreground">{maxResults}</strong> matching businesses</div>
              <div>② Each company website is auto-crawled for email contacts</div>
              <div>③ All leads are saved directly to your CRM — no import needed</div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} size="sm">Cancel</Button>
              <Button type="submit" disabled={createJobMutation.isPending} size="sm" className="gap-1.5">
                <Compass className="w-3.5 h-3.5" />
                {createJobMutation.isPending ? 'Launching...' : 'Start Discovery'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
