import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '../hooks/useWorkspace';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { QueueMonitor } from '../components/crm/QueueMonitor';
import {
  Megaphone,
  Plus,
  Mail,
  FileText,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  ArrowLeft,
  Users,
  ChevronRight,
  Activity,
  Archive,
  Layers,
  Settings,
  HelpCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function CampaignsScreen() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || '';
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('campaigns');
  
  // Navigation: null = list, string = campaign ID for detail view
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  // Modal Dialog states
  const [accountOpen, setAccountOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Selected Enrollment for stepper timeline panel
  const [selectedEnrollment, setSelectedEnrollment] = useState<any | null>(null);

  // Form field states
  const [accName, setAccName] = useState('');
  const [accEmail, setAccEmail] = useState('');
  const [accPassword, setAccPassword] = useState('');
  const [accDaily, setAccDaily] = useState(200);
  const [accHourly, setAccHourly] = useState(50);
  const [accSig, setAccSig] = useState('');

  const [tplName, setTplName] = useState('');
  const [tplSubj, setTplSubj] = useState('');
  const [tplBody, setTplBody] = useState('');

  // Wizard fields for Launching Campaign
  const [campName, setCampName] = useState('');
  const [campDesc, setCampDesc] = useState('');
  const [campSeqId, setCampSeqId] = useState('');
  const [campAccId, setCampAccId] = useState('');
  const [campLimit, setCampLimit] = useState(200);
  const [campTimezone, setCampTimezone] = useState('UTC');

  const [previewTemplateId, setPreviewTemplateId] = useState('');
  const [previewContactId, setPreviewContactId] = useState('');

  // Enrollment filter/search states
  const [enrollmentSearch, setEnrollmentSearch] = useState('');
  const [enrollmentStatusFilter, setEnrollmentStatusFilter] = useState('all');
  const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState<string[]>([]);

  // ── Query Hooks ─────────────────────────────────────────────────────────

  const accountsQuery = useQuery({
    queryKey: ['email_accounts', workspaceId],
    queryFn: async () => {
      return window.ipc.invoke('email-accounts:list', undefined);
    },
    enabled: !!workspaceId,
  });

  const templatesQuery = useQuery({
    queryKey: ['email_templates', workspaceId],
    queryFn: async () => {
      return window.ipc.invoke('templates:list', undefined);
    },
    enabled: !!workspaceId,
  });

  const sequencesQuery = useQuery({
    queryKey: ['sequences', workspaceId],
    queryFn: async () => {
      return window.ipc.invoke('sequence:list', undefined);
    },
    enabled: !!workspaceId,
  });

  const campaignsQuery = useQuery({
    queryKey: ['campaigns', workspaceId],
    queryFn: async () => {
      return window.ipc.invoke('campaigns:list', { workspaceId });
    },
    enabled: !!workspaceId,
  });

  const contactsQuery = useQuery({
    queryKey: ['contacts', 'list', workspaceId],
    queryFn: async () => {
      return window.ipc.invoke('contacts:list', { workspaceId });
    },
    enabled: !!workspaceId,
  });

  // Query to fetch enrollments for detail page
  const enrollmentsQuery = useQuery({
    queryKey: ['campaign_enrollments', workspaceId, selectedCampaignId],
    queryFn: async () => {
      return window.ipc.invoke('campaigns:enrollments:list', { workspaceId, campaignId: selectedCampaignId });
    },
    enabled: !!workspaceId && !!selectedCampaignId,
  });

  const previewQuery = useQuery({
    queryKey: ['template_preview', previewTemplateId, previewContactId],
    queryFn: async () => {
      const payload: { id: string; contactId?: string } = { id: previewTemplateId };
      if (previewContactId) {
        payload.contactId = previewContactId;
      }
      return window.ipc.invoke('templates:preview', payload);
    },
    enabled: !!previewTemplateId,
  });

  // ── Mutation Hooks ──────────────────────────────────────────────────────

  const createAccountMutation = useMutation({
    mutationFn: async (payload: any) => {
      return window.ipc.invoke('email-accounts:create', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email_accounts', workspaceId] });
      setAccountOpen(false);
      setAccName('');
      setAccEmail('');
      setAccPassword('');
      setAccSig('');
    },
    onError: (err: any) => {
      alert(`Connection failed: ${err.message}`);
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      return window.ipc.invoke('email-accounts:delete', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email_accounts', workspaceId] });
    },
  });

  const verifyAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      return window.ipc.invoke('email-accounts:test', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email_accounts', workspaceId] });
      alert('SMTP Connection Verified successfully!');
    },
    onError: (err: any) => {
      alert(`Verification failed: ${err.message}`);
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (payload: any) => {
      return window.ipc.invoke('templates:create', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email_templates', workspaceId] });
      setTemplateOpen(false);
      setTplName('');
      setTplSubj('');
      setTplBody('');
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      return window.ipc.invoke('templates:delete', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email_templates', workspaceId] });
    },
  });

  // Campaign Mutations
  const createCampaignMutation = useMutation({
    mutationFn: async (payload: any) => {
      return window.ipc.invoke('campaigns:create', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] });
      setCampaignOpen(false);
      setCampName('');
      setCampDesc('');
      setCampSeqId('');
      setCampAccId('');
    },
  });

  const updateCampaignStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return window.ipc.invoke('campaigns:update', { id, dto: { workspaceId, status } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['campaign_enrollments', workspaceId, selectedCampaignId] });
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      return window.ipc.invoke('campaigns:delete', { workspaceId, id });
    },
    onSuccess: () => {
      setSelectedCampaignId(null);
      queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] });
    },
  });

  // Enrollment Control Mutations
  const bulkPauseMutation = useMutation({
    mutationFn: async (enrollmentIds: string[]) => {
      return window.ipc.invoke('campaigns:bulk-pause-enrollments', { campaignId: selectedCampaignId, enrollmentIds });
    },
    onSuccess: () => {
      setSelectedEnrollmentIds([]);
      queryClient.invalidateQueries({ queryKey: ['campaign_enrollments', workspaceId, selectedCampaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] });
    },
  });

  const bulkResumeMutation = useMutation({
    mutationFn: async (enrollmentIds: string[]) => {
      return window.ipc.invoke('campaigns:bulk-resume-enrollments', { campaignId: selectedCampaignId, enrollmentIds });
    },
    onSuccess: () => {
      setSelectedEnrollmentIds([]);
      queryClient.invalidateQueries({ queryKey: ['campaign_enrollments', workspaceId, selectedCampaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] });
    },
  });

  const bulkRemoveMutation = useMutation({
    mutationFn: async (enrollmentIds: string[]) => {
      return window.ipc.invoke('campaigns:bulk-remove-enrollments', { campaignId: selectedCampaignId, enrollmentIds });
    },
    onSuccess: () => {
      setSelectedEnrollmentIds([]);
      queryClient.invalidateQueries({ queryKey: ['campaign_enrollments', workspaceId, selectedCampaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] });
    },
  });

  // Handlers
  const handleConnectAccount = (e: React.FormEvent) => {
    e.preventDefault();
    createAccountMutation.mutate({
      name: accName,
      email: accEmail,
      password: accPassword,
      dailyLimit: accDaily,
      hourlyLimit: accHourly,
      signature: accSig,
      provider: 'gmail_smtp',
    });
  };

  const handleCreateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    createTemplateMutation.mutate({
      name: tplName,
      subject: tplSubj,
      body: tplBody,
    });
  };

  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!campSeqId || !campAccId) {
      alert('Please connect/select a Sequence and Sender Account first.');
      return;
    }
    createCampaignMutation.mutate({
      name: campName,
      description: campDesc,
      sequenceId: campSeqId,
      sendingAccountId: campAccId,
      dailyLimit: campLimit,
      timezone: campTimezone,
      status: 'Draft',
      workspaceId
    });
  };

  const accounts = accountsQuery.data || [];
  const templates = templatesQuery.data || [];
  const campaigns = campaignsQuery.data || [];
  const contacts = contactsQuery.data || [];
  const sequences = sequencesQuery.data || [];
  const enrollments = enrollmentsQuery.data || [];

  // Filter enrollments by search query and status tab
  const filteredEnrollments = enrollments.filter((enroll: any) => {
    const fullName = `${enroll.firstName || ''} ${enroll.lastName || ''}`.toLowerCase();
    const email = (enroll.email || '').toLowerCase();
    const company = (enroll.companyName || '').toLowerCase();
    const matchSearch =
      fullName.includes(enrollmentSearch.toLowerCase()) ||
      email.includes(enrollmentSearch.toLowerCase()) ||
      company.includes(enrollmentSearch.toLowerCase());

    if (enrollmentStatusFilter === 'all') return matchSearch;
    return matchSearch && enroll.status.toLowerCase() === enrollmentStatusFilter.toLowerCase();
  });

  const getCampaignStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold px-2">Active</Badge>;
      case 'Paused':
        return <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-semibold px-2">Paused</Badge>;
      case 'Completed':
        return <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-semibold px-2">Completed</Badge>;
      case 'Archived':
        return <Badge className="bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 text-[9px] font-semibold px-2">Archived</Badge>;
      default:
        return <Badge className="bg-muted/10 text-muted-foreground border border-muted/20 text-[9px] font-semibold px-2">Draft</Badge>;
    }
  };

  const getEnrollmentStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'running':
      case 'queued':
      case 'starting':
        return <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse text-[9px]">Running</Badge>;
      case 'waiting':
        return <Badge className="bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 text-[9px]">Waiting</Badge>;
      case 'paused':
        return <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px]">Paused</Badge>;
      case 'replied':
        return <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold">Replied</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-bold">Failed</Badge>;
      case 'completed':
        return <Badge className="bg-green-500/10 text-green-400 border border-green-500/20 text-[9px] font-bold">Completed</Badge>;
      default:
        return <Badge variant="outline" className="text-[9px]">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 text-xs font-sans h-full overflow-y-auto pr-1">
      {/* ── TOP HEADER ────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Outreach Platform</h2>
          <p className="text-[11px] text-secondary mt-0.5">
            Manage Gmail senders, campaign lists, automated schedules, and follow-ups.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-sunken p-0.5 border border-border-subtle rounded flex w-max gap-1">
          <TabsTrigger value="campaigns" className="px-3 py-1.5 flex items-center gap-1.5">
            <Megaphone className="h-3 w-3" />
            <span>Campaigns</span>
          </TabsTrigger>
          <TabsTrigger value="monitor" className="px-3 py-1.5 flex items-center gap-1.5">
            <Activity className="h-3 w-3" />
            <span>Queue Monitor</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="px-3 py-1.5 flex items-center gap-1.5">
            <FileText className="h-3 w-3" />
            <span>Templates</span>
          </TabsTrigger>
          <TabsTrigger value="accounts" className="px-3 py-1.5 flex items-center gap-1.5">
            <Mail className="h-3 w-3" />
            <span>Sender Accounts</span>
          </TabsTrigger>
        </TabsList>

        {/* ── CAMPAIGNS TAB (LIST VIEW OR DETAIL VIEW) ──────────────────────── */}
        <TabsContent value="campaigns" className="mt-4 space-y-4">
          {!selectedCampaignId ? (
            /* ──── LIST OF CAMPAIGNS ──── */
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-foreground text-[11px]">Outbound Campaigns</span>
                <Button onClick={() => setCampaignOpen(true)} size="sm" className="flex items-center gap-1">
                  <Plus className="h-3 w-3" />
                  Launch Campaign
                </Button>
              </div>

              <div className="bg-card border border-border-subtle rounded-xl overflow-hidden shadow-sm">
                <Table>
                  <TableHeader className="bg-sunken/40">
                    <TableRow>
                      <TableHead>Campaign Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sequence</TableHead>
                      <TableHead>Sender Account</TableHead>
                      <TableHead className="text-center">Enrolled</TableHead>
                      <TableHead className="text-center text-blue-400">Running</TableHead>
                      <TableHead className="text-center text-zinc-400">Waiting</TableHead>
                      <TableHead className="text-center text-emerald-400">Replies</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((camp: any) => {
                      const sequence = sequences.find((s: any) => s.id === camp.sequenceId);
                      const account = accounts.find((a: any) => a.id === camp.sendingAccountId);
                      return (
                        <TableRow
                          key={camp.id}
                          className="hover:bg-sunken/10 cursor-pointer"
                          onClick={() => setSelectedCampaignId(camp.id)}
                        >
                          <TableCell className="font-semibold text-foreground py-3">
                            {camp.name}
                            <span className="block text-[10px] text-muted-foreground font-normal mt-0.5">
                              {camp.description || 'No description provided.'}
                            </span>
                          </TableCell>
                          <TableCell>{getCampaignStatusBadge(camp.status)}</TableCell>
                          <TableCell>{sequence?.name || '—'}</TableCell>
                          <TableCell>{account?.email || '—'}</TableCell>
                          <TableCell className="text-center font-mono font-bold">{camp.contactsCount || 0}</TableCell>
                          <TableCell className="text-center font-mono text-blue-400">{camp.runningCount || 0}</TableCell>
                          <TableCell className="text-center font-mono text-zinc-400">{camp.waitingCount || 0}</TableCell>
                          <TableCell className="text-center font-mono text-emerald-400">{camp.repliedCount || 0}</TableCell>
                          <TableCell className="text-right py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1.5">
                              {camp.status === 'Paused' || camp.status === 'Draft' ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => updateCampaignStatusMutation.mutate({ id: camp.id, status: 'Active' })}
                                  className="h-7 text-emerald-500 hover:bg-emerald-500/10 gap-0.5"
                                >
                                  <Play className="h-3 w-3" />
                                  Resume
                                </Button>
                              ) : camp.status === 'Active' ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => updateCampaignStatusMutation.mutate({ id: camp.id, status: 'Paused' })}
                                  className="h-7 text-amber-500 hover:bg-amber-500/10 gap-0.5"
                                >
                                  <Pause className="h-3 w-3" />
                                  Pause
                                </Button>
                              ) : null}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (confirm('Are you sure you want to delete this campaign? All enrollments will be deleted.')) {
                                    deleteCampaignMutation.mutate(camp.id);
                                  }
                                }}
                                className="h-7 text-red-500 hover:bg-red-500/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {campaigns.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                          No outbound campaigns created yet. Click "Launch Campaign" to start.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            /* ──── CAMPAIGN DETAILS VIEW ──── */
            (() => {
              const campaign = campaigns.find((c: any) => c.id === selectedCampaignId);
              if (!campaign) return null;
              const sequence = sequences.find((s: any) => s.id === campaign.sequenceId);
              const account = accounts.find((a: any) => a.id === campaign.sendingAccountId);

              return (
                <div className="space-y-5">
                  <div className="flex justify-between items-center pb-2 border-b border-border-subtle">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedCampaignId(null);
                        setSelectedEnrollment(null);
                      }}
                      className="gap-1 h-8 text-[11px]"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Back to Campaigns
                    </Button>

                    <div className="flex items-center gap-2">
                      {campaign.status === 'Active' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateCampaignStatusMutation.mutate({ id: campaign.id, status: 'Paused' })}
                          className="h-8 text-[10px] text-amber-500 border-amber-500/20 gap-1 hover:bg-amber-500/5"
                        >
                          <Pause className="h-3.5 w-3.5" />
                          Pause Campaign
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateCampaignStatusMutation.mutate({ id: campaign.id, status: 'Active' })}
                          className="h-8 text-[10px] text-emerald-500 border-emerald-500/20 gap-1 hover:bg-emerald-500/5"
                        >
                          <Play className="h-3.5 w-3.5" />
                          Resume Campaign
                        </Button>
                      )}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm('Archive this campaign?')) {
                            updateCampaignStatusMutation.mutate({ id: campaign.id, status: 'Archived' });
                          }
                        }}
                        className="h-8 text-[10px] text-zinc-400 gap-1"
                      >
                        <Archive className="h-3.5 w-3.5" />
                        Archive
                      </Button>
                    </div>
                  </div>

                  {/* Campaign Info Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-card border border-border-subtle rounded-xl p-3.5 space-y-1">
                      <span className="text-[10px] text-muted-foreground">Campaign Status</span>
                      <div className="flex items-center justify-between">
                        <span className="text-base font-bold text-foreground">{campaign.name}</span>
                        {getCampaignStatusBadge(campaign.status)}
                      </div>
                      <span className="block text-[9px] text-muted-foreground mt-0.5">{campaign.description || '—'}</span>
                    </div>

                    <div className="bg-card border border-border-subtle rounded-xl p-3.5 space-y-1">
                      <span className="text-[10px] text-muted-foreground">Active Sequence</span>
                      <div className="text-xs font-bold text-foreground truncate flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5 text-accent" />
                        {sequence?.name || '—'}
                      </div>
                      <span className="block text-[9px] text-muted-foreground">
                        Steps: {sequence?.steps ? JSON.parse(sequence.steps).length : 0} steps
                      </span>
                    </div>

                    <div className="bg-card border border-border-subtle rounded-xl p-3.5 space-y-1">
                      <span className="text-[10px] text-muted-foreground">Sender Account</span>
                      <div className="text-xs font-bold text-foreground truncate flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5 text-accent" />
                        {account?.name || '—'}
                      </div>
                      <span className="block text-[9px] text-muted-foreground truncate">{account?.email || '—'}</span>
                    </div>

                    <div className="bg-card border border-border-subtle rounded-xl p-3.5 space-y-1">
                      <span className="text-[10px] text-muted-foreground">Delivery Limits</span>
                      <div className="text-xs font-bold text-foreground font-mono">
                        {campaign.dailyLimit || 200} daily / {campaign.timezone || 'UTC'}
                      </div>
                      <span className="block text-[9px] text-muted-foreground">Workspace local settings apply</span>
                    </div>
                  </div>

                  {/* Campaign Dashboard Stats */}
                  <div className="grid grid-cols-7 gap-2 bg-sunken/30 border border-border-subtle/50 rounded-xl p-3.5">
                    <div className="text-center border-r border-border-subtle/50">
                      <span className="block font-mono text-base font-bold text-foreground">{campaign.contactsCount || 0}</span>
                      <span className="text-[9px] text-muted-foreground">Enrolled</span>
                    </div>
                    <div className="text-center border-r border-border-subtle/50">
                      <span className="block font-mono text-base font-bold text-blue-400">{campaign.runningCount || 0}</span>
                      <span className="text-[9px] text-muted-foreground">Running</span>
                    </div>
                    <div className="text-center border-r border-border-subtle/50">
                      <span className="block font-mono text-base font-bold text-zinc-400">{campaign.waitingCount || 0}</span>
                      <span className="text-[9px] text-muted-foreground">Waiting</span>
                    </div>
                    <div className="text-center border-r border-border-subtle/50">
                      <span className="block font-mono text-base font-bold text-emerald-400">{campaign.repliedCount || 0}</span>
                      <span className="text-[9px] text-muted-foreground">Replies</span>
                    </div>
                    <div className="text-center border-r border-border-subtle/50">
                      <span className="block font-mono text-base font-bold text-green-400">{campaign.completedCount || 0}</span>
                      <span className="text-[9px] text-muted-foreground">Completed</span>
                    </div>
                    <div className="text-center border-r border-border-subtle/50">
                      <span className="block font-mono text-base font-bold text-amber-400">{campaign.pausedCount || 0}</span>
                      <span className="text-[9px] text-muted-foreground">Paused</span>
                    </div>
                    <div className="text-center">
                      <span className="block font-mono text-base font-bold text-red-400">{campaign.failedCount || 0}</span>
                      <span className="text-[9px] text-muted-foreground">Failed</span>
                    </div>
                  </div>

                  {/* Main detail workflow section: Left Enrollment Table, Right Timeline Stepper */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Enrollment Table Column */}
                    <div className="lg:col-span-2 space-y-3 bg-card border border-border-subtle rounded-xl p-4 shadow-sm">
                      <div className="flex justify-between items-center gap-2">
                        <h4 className="font-semibold text-foreground text-[11px] flex items-center gap-1.5">
                          <Users className="h-4 w-4 text-accent" />
                          Enrolled Recipient Leads
                        </h4>

                        {/* Search and filter toolbar */}
                        <div className="flex gap-2">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              placeholder="Search leads..."
                              value={enrollmentSearch}
                              onChange={(e) => setEnrollmentSearch(e.target.value)}
                              className="pl-8 h-7 text-[10px] w-40"
                            />
                          </div>
                          <select
                            value={enrollmentStatusFilter}
                            onChange={(e) => setEnrollmentStatusFilter(e.target.value)}
                            className="h-7 text-[10px] bg-background border border-input rounded px-1.5 focus-visible:outline-none"
                          >
                            <option value="all">All Statuses</option>
                            <option value="running">Running</option>
                            <option value="waiting">Waiting</option>
                            <option value="paused">Paused</option>
                            <option value="replied">Replied</option>
                            <option value="completed">Completed</option>
                            <option value="failed">Failed</option>
                          </select>
                        </div>
                      </div>

                      {/* Bulk Actions Banner on selections */}
                      {selectedEnrollmentIds.length > 0 && (
                        <div className="flex items-center justify-between bg-sunken border border-border-subtle rounded-lg p-2.5 text-[10px]">
                          <span className="font-semibold text-foreground">{selectedEnrollmentIds.length} lead(s) selected</span>
                          <div className="flex gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => bulkResumeMutation.mutate(selectedEnrollmentIds)}
                              className="h-6 text-[9px] px-2 text-emerald-500"
                            >
                              Resume
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => bulkPauseMutation.mutate(selectedEnrollmentIds)}
                              className="h-6 text-[9px] px-2 text-amber-500"
                            >
                              Pause
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (confirm(`Remove ${selectedEnrollmentIds.length} lead(s) from campaign?`)) {
                                  bulkRemoveMutation.mutate(selectedEnrollmentIds);
                                }
                              }}
                              className="h-6 text-[9px] px-2 text-red-500"
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Enrolled Leads Table */}
                      <div className="border border-border-subtle rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader className="bg-sunken/40">
                            <TableRow>
                              <TableHead className="w-8 py-2">
                                <input
                                  type="checkbox"
                                  checked={selectedEnrollmentIds.length === filteredEnrollments.length && filteredEnrollments.length > 0}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedEnrollmentIds(filteredEnrollments.map((x: any) => x.id));
                                    } else {
                                      setSelectedEnrollmentIds([]);
                                    }
                                  }}
                                  className="rounded"
                                />
                              </TableHead>
                              <TableHead className="py-2">Contact</TableHead>
                              <TableHead className="py-2">Next Run</TableHead>
                              <TableHead className="py-2">Status</TableHead>
                              <TableHead className="py-2 text-center">Sends</TableHead>
                              <TableHead className="py-2 text-right">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredEnrollments.map((enroll: any) => {
                              const isChecked = selectedEnrollmentIds.includes(enroll.id);
                              const nextRun = enroll.nextExecutionAt
                                ? formatDistanceToNow(new Date(enroll.nextExecutionAt))
                                : '—';
                              return (
                                <TableRow
                                  key={enroll.id}
                                  className={`hover:bg-sunken/10 cursor-pointer ${
                                    selectedEnrollment?.id === enroll.id ? 'bg-sunken/20' : ''
                                  }`}
                                  onClick={() => setSelectedEnrollment(enroll)}
                                >
                                  <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedEnrollmentIds([...selectedEnrollmentIds, enroll.id]);
                                        } else {
                                          setSelectedEnrollmentIds(selectedEnrollmentIds.filter((x) => x !== enroll.id));
                                        }
                                      }}
                                      className="rounded"
                                    />
                                  </TableCell>
                                  <TableCell className="py-2">
                                    <div className="font-semibold text-foreground">
                                      {enroll.firstName} {enroll.lastName || ''}
                                    </div>
                                    <div className="text-[9px] text-muted-foreground font-mono mt-0.5">
                                      {enroll.email} | {enroll.companyName || 'No Company'}
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-2 font-mono text-[9px]">{nextRun}</TableCell>
                                  <TableCell className="py-2">{getEnrollmentStatusBadge(enroll.status)}</TableCell>
                                  <TableCell className="py-2 text-center font-mono">{enroll.emailsSent || 0}</TableCell>
                                  <TableCell className="py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground inline" />
                                  </TableCell>
                                </TableRow>
                              );
                            })}

                            {filteredEnrollments.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                                  No enrolled contacts found.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    {/* Timeline Progression / Execution Stepper Panel */}
                    <div className="bg-card border border-border-subtle rounded-xl p-4 shadow-sm space-y-4">
                      <h4 className="font-semibold text-foreground text-[11px] flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-accent" />
                        Sequence Execution Timeline
                      </h4>

                      {selectedEnrollment ? (
                        <div className="space-y-4">
                          {/* Selected Lead details */}
                          <div className="pb-3 border-b border-border-subtle">
                            <div className="font-bold text-foreground text-xs">
                              {selectedEnrollment.firstName} {selectedEnrollment.lastName || ''}
                            </div>
                            <span className="block text-[10px] text-muted-foreground mt-0.5">{selectedEnrollment.email}</span>
                          </div>

                          {/* Render visual sequence steps */}
                          <div className="relative pl-4 border-l border-border-subtle space-y-4">
                            {/* Initial Step */}
                            <div className="relative">
                              <span className="absolute -left-[21px] top-0 bg-green-500 rounded-full h-3 w-3 border-2 border-card" />
                              <div className="font-bold text-foreground text-[10px]">Enrollment Initialized</div>
                              <span className="block text-[9px] text-muted-foreground font-mono">
                                {new Date(selectedEnrollment.createdAt).toLocaleString()}
                              </span>
                            </div>

                            {/* Stepper logic mapping sequence steps */}
                            {(() => {
                              const rawSteps = sequence?.steps ? JSON.parse(sequence.steps) : [];
                              return rawSteps.map((step: any, index: number) => {
                                const isCurrent = selectedEnrollment.currentStep === index;
                                const isPassed = selectedEnrollment.currentStep > index;
                                
                                // Determine step status colors
                                let color = 'bg-zinc-600';
                                if (isCurrent) color = 'bg-blue-500 animate-pulse';
                                if (isPassed) color = 'bg-green-500';
                                if (selectedEnrollment.status === 'failed' && isCurrent) color = 'bg-red-500';

                                return (
                                  <div key={step.id} className="relative">
                                    <span className={`absolute -left-[21px] top-0 rounded-full h-3 w-3 border-2 border-card ${color}`} />
                                    <div className="font-bold text-foreground text-[10px]">
                                      Step {index + 1}: {step.type.toUpperCase()}
                                    </div>
                                    <div className="text-[9px] text-muted-foreground mt-0.5">
                                      {step.type === 'email' ? 'Outgoing message dispatch' : `Wait duration: ${step.config.delayDays || 1} day(s)`}
                                    </div>
                                  </div>
                                );
                              });
                            })()}

                            {/* Replied state step */}
                            {selectedEnrollment.status === 'replied' && (
                              <div className="relative">
                                <span className="absolute -left-[21px] top-0 bg-emerald-500 rounded-full h-3 w-3 border-2 border-card animate-bounce" />
                                <div className="font-bold text-emerald-400 text-[10px]">Reply Received</div>
                                <span className="block text-[9px] text-emerald-500/80 font-mono">Sequence auto-terminated</span>
                              </div>
                            )}
                          </div>

                          {/* Raw logs output */}
                          <div className="space-y-1.5 pt-3 border-t border-border-subtle">
                            <span className="block font-semibold text-foreground text-[10px]">Technical Audit Logs:</span>
                            <div className="bg-sunken border border-border-subtle rounded-lg p-2.5 font-mono text-[9px] max-h-40 overflow-y-auto space-y-1 text-muted-foreground">
                              {selectedEnrollment.logs && selectedEnrollment.logs.length > 0 ? (
                                selectedEnrollment.logs.map((log: any, idx: number) => (
                                  <div key={idx} className="border-b border-border-subtle/30 pb-1 last:border-0 last:pb-0">
                                    <span className="text-zinc-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                                    <span className="text-foreground font-semibold">{log.action || 'Log'}:</span> {log.message}
                                  </div>
                                ))
                              ) : (
                                <div className="text-center py-2 italic text-zinc-500">No telemetry log entries.</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-10 text-muted-foreground italic">
                          Select a contact from the leads table to view their execution timeline stepper.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </TabsContent>

        {/* ── QUEUE MONITOR TAB (INTEGRATED COMPONENT) ───────────────────── */}
        <TabsContent value="monitor" className="mt-4">
          <QueueMonitor />
        </TabsContent>

        {/* ── EMAIL TEMPLATES TAB ─────────────────────────────────────────── */}
        <TabsContent value="templates" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-foreground text-[11px]">Email Copy Templates</span>
            <Button onClick={() => setTemplateOpen(true)} size="sm" className="flex items-center gap-1">
              <Plus className="h-3 w-3" />
              Create Template
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((tpl: any) => (
              <div key={tpl.id} className="bg-card border border-border-subtle rounded-xl p-4 space-y-3 shadow-sm hover:shadow-md transition">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-foreground text-xs">{tpl.name}</h4>
                    <span className="block text-[10px] text-muted-foreground truncate max-w-xs mt-0.5">Subject: {tpl.subject}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setPreviewTemplateId(tpl.id);
                        setPreviewOpen(true);
                      }}
                      className="h-7 text-[10px] gap-0.5"
                    >
                      <Eye className="h-3 w-3" />
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteTemplateMutation.mutate(tpl.id)}
                      className="h-7 w-7 p-0 text-red-500 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="bg-sunken border border-border-subtle rounded p-2.5 font-mono text-[10px] text-secondary max-h-24 overflow-y-auto whitespace-pre-wrap">
                  {tpl.body}
                </div>
              </div>
            ))}

            {templates.length === 0 && (
              <div className="col-span-2 text-center py-10 border border-dashed border-border-subtle rounded-xl text-muted-foreground">
                No templates configured. Click 'Create Template' to start mapping merge copy.
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── SENDER ACCOUNTS TAB ─────────────────────────────────────────── */}
        <TabsContent value="accounts" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-foreground text-[11px]">Gmail Outbound Senders</span>
            <Button onClick={() => setAccountOpen(true)} size="sm" className="flex items-center gap-1">
              <Plus className="h-3 w-3" />
              Connect Gmail
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.map((acc: any) => (
              <div key={acc.id} className="bg-card border border-border-subtle rounded-xl p-4 space-y-3.5 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-foreground text-xs">{acc.name}</h4>
                    <span className="block text-[10px] text-muted-foreground font-mono mt-0.5">{acc.email}</span>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => verifyAccountMutation.mutate(acc.id)}
                      className="h-7 text-[10px] gap-0.5"
                    >
                      Verify SMTP
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteAccountMutation.mutate(acc.id)}
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="flex justify-between items-center text-[10px] pt-2 border-t border-border-subtle/50">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${acc.status === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                    <span className="capitalize font-semibold">{acc.status}</span>
                  </div>
                  <span className="font-mono text-muted-foreground">{`Limits: ${acc.dailySent || 0}/${acc.dailyLimit} daily`}</span>
                </div>
              </div>
            ))}

            {accounts.length === 0 && (
              <div className="col-span-2 text-center py-10 border border-dashed border-border-subtle rounded-xl text-muted-foreground">
                No connected Gmail accounts found. Click 'Connect Gmail' to setup credentials.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Connect Account Dialog ────────────────────────────────────────── */}
      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Connect Gmail SMTP</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleConnectAccount} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="accName">Sender Name</Label>
              <Input
                id="accName"
                placeholder="CEO / Sales Manager"
                value={accName}
                onChange={(e) => setAccName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="accEmail">Gmail Email Address</Label>
              <Input
                id="accEmail"
                type="email"
                placeholder="sales@mycompany.com"
                value={accEmail}
                onChange={(e) => setAccEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="accPassword">Gmail App Password</Label>
              <Input
                id="accPassword"
                type="password"
                placeholder="xxxx xxxx xxxx xxxx"
                value={accPassword}
                onChange={(e) => setAccPassword(e.target.value)}
                required
              />
              <p className="text-[9px] text-muted flex items-center gap-0.5 mt-0.5">
                <HelpCircle className="h-3 w-3" />
                Must be a 16-character Google App Password (not your primary password).
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="accDaily">Daily Limit</Label>
                <Input
                  id="accDaily"
                  type="number"
                  value={accDaily}
                  onChange={(e) => setAccDaily(parseInt(e.target.value))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="accHourly">Hourly Limit</Label>
                <Input
                  id="accHourly"
                  type="number"
                  value={accHourly}
                  onChange={(e) => setAccHourly(parseInt(e.target.value))}
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="accSig">Signature (Plaintext or HTML)</Label>
              <Textarea
                id="accSig"
                placeholder="Best regards, Sales Team"
                value={accSig}
                onChange={(e) => setAccSig(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
              <Button type="button" variant="outline" onClick={() => setAccountOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createAccountMutation.isPending}>
                {createAccountMutation.isPending ? 'Verifying SMTP...' : 'Verify & Save'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Create Template Dialog ───────────────────────────────────────── */}
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Email Template</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTemplate} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="tplName">Template Name</Label>
              <Input
                id="tplName"
                placeholder="Cold Pitch v1"
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tplSubj">Subject Line</Label>
              <Input
                id="tplSubj"
                placeholder="Quick question for {{firstName}} at {{company}}"
                value={tplSubj}
                onChange={(e) => setTplSubj(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tplBody">Email Body (HTML supported)</Label>
              <Textarea
                id="tplBody"
                rows={6}
                placeholder="Hi {{firstName}}, I saw {{website}}..."
                value={tplBody}
                onChange={(e) => setTplBody(e.target.value)}
                required
              />
              <p className="text-[9px] text-muted mt-0.5">
                Merge variables: <code className="font-mono bg-sunken px-1 rounded">{`{{firstName}}`}</code>,{' '}
                <code className="font-mono bg-sunken px-1 rounded">{`{{lastName}}`}</code>,{' '}
                <code className="font-mono bg-sunken px-1 rounded">{`{{company}}`}</code>,{' '}
                <code className="font-mono bg-sunken px-1 rounded">{`{{website}}`}</code>
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
              <Button type="button" variant="outline" onClick={() => setTemplateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTemplateMutation.isPending}>
                Save Template
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Launch Campaign Dialog ───────────────────────────────────────── */}
      <Dialog open={campaignOpen} onOpenChange={setCampaignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Launch Outbound Campaign</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCampaign} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="campName">Campaign Name</Label>
              <Input
                id="campName"
                placeholder="Q4 SaaS Leads Hunt"
                value={campName}
                onChange={(e) => setCampName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="campDesc">Description</Label>
              <Textarea
                id="campDesc"
                placeholder="Brief summary of target audience and goals..."
                value={campDesc}
                onChange={(e) => setCampDesc(e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="campSeq">Outbound Sequence</Label>
                <select
                  id="campSeq"
                  value={campSeqId}
                  onChange={(e) => setCampSeqId(e.target.value)}
                  className="w-full h-8 px-2 bg-background border border-input rounded text-xs focus-visible:outline-none"
                  required
                >
                  <option value="">-- Select Sequence --</option>
                  {sequences.map((seq: any) => (
                    <option key={seq.id} value={seq.id}>
                      {seq.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="campAcc">Sender Email Account</Label>
                <select
                  id="campAcc"
                  value={campAccId}
                  onChange={(e) => setCampAccId(e.target.value)}
                  className="w-full h-8 px-2 bg-background border border-input rounded text-xs focus-visible:outline-none"
                  required
                >
                  <option value="">-- Select Account --</option>
                  {accounts.map((acc: any) => (
                    <option key={acc.id} value={acc.id}>
                      {`${acc.name} (${acc.email})`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="campLimit">Daily Send Limit</Label>
                <Input
                  id="campLimit"
                  type="number"
                  value={campLimit}
                  onChange={(e) => setCampLimit(parseInt(e.target.value))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="campTz">Timezone</Label>
                <Input
                  id="campTz"
                  value={campTimezone}
                  onChange={(e) => setCampTimezone(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
              <Button type="button" variant="outline" onClick={() => setCampaignOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createCampaignMutation.isPending}>
                Create Draft Campaign
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Live Preview Drawer Dialog ────────────────────────────────────── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Template Live Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="previewContact">Preview Recipient Contact</Label>
              <select
                id="previewContact"
                value={previewContactId}
                onChange={(e) => setPreviewContactId(e.target.value)}
                className="w-full h-8 px-2 bg-background border border-input rounded text-xs focus-visible:outline-none"
              >
                <option value="">-- Default Fallback Contact --</option>
                {contacts.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {`${c.firstName} ${c.lastName || ''} (${c.email})`}
                  </option>
                ))}
              </select>
            </div>

            {previewQuery.isLoading ? (
              <div className="text-center py-4 text-muted-foreground">Compiling template...</div>
            ) : previewQuery.data ? (
              <div className="border border-border-subtle rounded p-3 bg-sunken space-y-2 font-mono">
                <div className="font-bold text-foreground">
                  Subject: <span className="font-normal font-sans text-secondary">{previewQuery.data.subject}</span>
                </div>
                <div className="border-t border-border-subtle pt-2 text-foreground font-sans whitespace-pre-wrap">
                  {previewQuery.data.body}
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-2">
              <Button onClick={() => setPreviewOpen(false)}>Close Preview</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
