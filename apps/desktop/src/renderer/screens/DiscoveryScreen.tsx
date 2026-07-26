import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '../hooks/useWorkspace';
import {
  SyncCompanyRepository,
  SyncContactRepository
} from '../repositories/sync';
import { checkDeduplication } from '../utils/deduplicate';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Compass,
  Play,
  CheckCircle,
  AlertTriangle,
  Building,
  Plus,
  RefreshCw,
  Clock,
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react';

/**
 * DiscoveryScreen renders widgets, active search jobs, scraped results,
 * and handles CRM import operations with local deduplication.
 */
export default function DiscoveryScreen() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || '';
  const queryClient = useQueryClient();

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  
  // Job creation form state
  const [jobName, setJobName] = useState('');
  const [jobQuery, setJobQuery] = useState('');

  // 1. Fetch scheduler jobs
  const jobsQuery = useQuery({
    queryKey: ['scheduler_jobs', 'list', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      return window.ipc.invoke('scheduler:jobs:list', { workspaceId });
    },
    enabled: !!workspaceId,
    refetchInterval: 1500, // Poll every 1.5 seconds for real-time progress bar updates!
  });

  // 2. Fetch companies from CRM cache
  const companiesQuery = useQuery({
    queryKey: ['companies', 'list', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      return SyncCompanyRepository.listAndSync(workspaceId);
    },
    enabled: !!workspaceId,
    refetchInterval: 2000, // Poll every 2s so newly scraped companies render live!
  });

  // 3. Job Mutation handlers
  const createJobMutation = useMutation({
    mutationFn: async (payload: { name: string; query: string }) => {
      return window.ipc.invoke('scheduler:jobs:submit', {
        workspaceId,
        type: 'scraper:maps',
        payload: { name: payload.name, query: payload.query },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduler_jobs', 'list', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['companies', 'list', workspaceId] });
      setCreateOpen(false);
      setJobName('');
      setJobQuery('');
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
    createJobMutation.mutate({ name: jobName, query: jobQuery });
  };

  const jobs = (jobsQuery.data || []) as any[];
  const existingCompanies = (companiesQuery.data || []) as any[];

  // Find query from currently selected job
  const selectedJob = jobs.find(j => j.id === selectedJobId);
  const selectedJobPayload = selectedJob ? JSON.parse(selectedJob.payload || '{}') : {};
  const selectedQuery = (selectedJobPayload.query || '').toLowerCase().trim();

  // Filter companies matching the selected job query to show under "Scraped Results"
  const results = existingCompanies.filter(c => {
    if (!selectedQuery) return true;
    const searchBlob = `${c.name || ''} ${c.domain || ''} ${c.website || ''} ${c.location || ''}`.toLowerCase();
    
    // Exact substring match
    if (searchBlob.includes(selectedQuery)) return true;
    
    // Flexible word/stem match (e.g. "Architectures" -> matches "Architect", "Architects")
    const words = selectedQuery.split(/\s+/).filter((w: string) => w.length > 2);
    if (words.length === 0) return true;
    return words.some((word: string) => {
      const stem = word.replace(/(ures|ure|s|es)$/i, '');
      return searchBlob.includes(word) || (stem.length >= 3 && searchBlob.includes(stem));
    });
  });

  // Statistics calculation
  const totalJobs = jobs.length;
  const runningJobs = jobs.filter((j) => j.status === 'running' || j.status === 'queued' || j.status === 'retrying').length;
  const totalDiscovered = results.length;

  return (
    <div className="space-y-6 text-xs font-sans h-full overflow-y-auto pr-1">
      <div className="flex justify-between items-end border-b border-border-subtle pb-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Discovery Platform</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Identify accounts, enrich domains, and import leads with deduplication filters.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm" className="h-9 font-semibold gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          New Discovery Job
        </Button>
      </div>

      {/* Widgets Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Scraper Jobs', value: totalJobs, description: 'Created in this workspace' },
          { label: 'Running / Queued', value: runningJobs, description: 'Background scraping loops' },
          { label: 'Imported Leads', value: existingCompanies.length, description: 'CRM validated records' },
        ].map((widget, idx) => (
          <div key={idx} className="bg-card border border-border-subtle p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
              {widget.label}
            </span>
            <div className="text-xl font-bold text-foreground mt-1">{widget.value}</div>
            <span className="text-[9px] text-muted-foreground block mt-0.5">{widget.description}</span>
          </div>
        ))}
      </div>

      {/* Main Jobs Listing */}
      <div className="bg-card border border-border-subtle rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
          <h3 className="font-bold text-foreground uppercase tracking-wider text-[10px]">Job Queue</h3>
          <Button variant="ghost" size="icon" onClick={() => jobsQuery.refetch()} className="w-6 h-6 p-0 text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>

        {jobs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No discovery searches launched yet.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-sunken/40 text-[9px] font-bold text-muted-foreground uppercase border-b border-border-subtle tracking-wider">
                <th className="px-4 py-2.5">Job Name</th>
                <th className="px-4 py-2.5">Keywords / Query</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Progress</th>
                <th className="px-4 py-2.5">Statistics</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/50">
              {jobs.map((job) => {
                const isSelected = selectedJobId === job.id;
                const payloadObj = JSON.parse(job.payload || '{}');
                const displayName = payloadObj.name || job.type;
                const queryStr = payloadObj.query || '';
                const isRunnable = ['queued', 'running', 'retrying'].includes(job.status);

                return (
                  <tr
                    key={job.id}
                    onClick={() => setSelectedJobId(job.id)}
                    className={`hover:bg-sunken/30 cursor-pointer transition-colors ${
                      isSelected ? 'bg-accent/5 font-medium' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-semibold text-foreground">{displayName}</td>
                    <td className="px-4 py-3 font-mono text-accent">{queryStr}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`text-[9px] font-bold uppercase ${
                          job.status === 'completed'
                            ? 'bg-green-500/10 text-green-500 border-green-500/20'
                            : job.status === 'running'
                            ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                            : job.status === 'cancelled'
                            ? 'bg-red-500/10 text-red-500 border-red-500/20'
                            : 'bg-muted/10 text-muted-foreground border-muted/20'
                        }`}
                      >
                        {job.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 w-40">
                      <div className="flex items-center gap-2">
                        <div className="w-full bg-sunken rounded-full h-1.5 overflow-hidden border border-border-subtle">
                          <div
                            className="bg-accent h-full transition-all duration-300"
                            style={{ width: `${job.progress || 0}%` }}
                          />
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground">{job.progress || 0}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      Max Retries: {job.maxRetries}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {isRunnable ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelJobMutation.mutate(job.id);
                          }}
                          disabled={cancelJobMutation.isPending}
                          className="h-6 text-[10px] text-red-500 hover:text-white hover:bg-red-500 border-red-500/25"
                        >
                          Cancel
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1">
                          View
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Lead Discovery Results Table */}
      {selectedJobId && (
        <div className="bg-card border border-border-subtle rounded-xl overflow-hidden shadow-sm animate-in slide-in-from-bottom duration-200">
          <div className="px-4 py-3 border-b border-border-subtle flex justify-between items-center bg-sunken/10">
            <h3 className="font-bold text-foreground uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-accent" />
              Scraped Results (Query: "{selectedQuery}")
            </h3>
            <span className="text-[10px] text-muted-foreground">
              These discovered leads have been directly populated in your local workspace CRM database.
            </span>
          </div>

          {companiesQuery.isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading leads...</div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {selectedJob?.status === 'running'
                ? 'No leads scraped yet. Scraper is running...'
                : 'No leads found for this query.'}
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-sunken border-b border-border-subtle text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                  <th className="px-4 py-2.5">Company Name</th>
                  <th className="px-4 py-2.5">Domain</th>
                  <th className="px-4 py-2.5">Phone</th>
                  <th className="px-4 py-2.5">Location</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {results.map((res) => {
                  return (
                    <tr key={res.id} className="hover:bg-sunken/10 transition-colors">
                      <td className="px-4 py-3 font-semibold text-foreground">{res.name}</td>
                      <td className="px-4 py-3 font-mono text-accent">{res.website || 'N/A'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{res.phone || 'N/A'}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{res.location || 'N/A'}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 font-bold text-[9px]">
                          ACTIVE IN CRM
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Creation Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Launch Discovery Search</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateJob} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="jobName" className="text-xs font-semibold">Job Name</Label>
              <Input
                id="jobName"
                placeholder="Q4 SaaS Leads Hunt"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="jobQuery" className="text-xs font-semibold">Keywords / Query</Label>
              <Input
                id="jobQuery"
                placeholder="Software Development Agency"
                value={jobQuery}
                onChange={(e) => setJobQuery(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} size="sm">
                Cancel
              </Button>
              <Button type="submit" disabled={createJobMutation.isPending} size="sm">
                {createJobMutation.isPending ? 'Launching...' : 'Run Discovery Job'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
