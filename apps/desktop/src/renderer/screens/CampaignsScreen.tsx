import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '../hooks/useWorkspace';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../components/ui/table';
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
  Layers,
  Archive,
  HelpCircle,
  Activity,
  Settings
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { PageHeader } from '../components/common/PageHeader';
import {
  ProgressiveSequenceEditor,
  type SequenceStepItem
} from '../components/crm/ProgressiveSequenceEditor';

/**
 * CampaignsScreen — outbound sequences dashboard, templates, and SMTP senders.
 *
 * Design updates:
 *   - Squared corners: all buttons, dialog contents, tabs, badges, cards, code tags, select boxes, and table containers use rounded-none.
 *   - Correct Palette: uses semantic design tokens (primary, info, success, warning, danger).
 *   - Pagination: client-side pagination for Campaigns table and Enrolled leads table.
 *   - Stable Callback references to prevent state resets.
 *   - Premium Empty States: gorgeous, styled empty states matching CRM list designs.
 */
export default function CampaignsScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialAudienceId = searchParams.get('audienceId') || '';

  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || '';
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('campaigns');

  // Navigation: null = list, string = campaign ID for detail view
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  // Modal Dialog states
  const [accountOpen, setAccountOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(!!initialAudienceId);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Selected Enrollment for stepper timeline panel
  const [selectedEnrollment, setSelectedEnrollment] = useState<any | null>(null);

  // Form field states
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

  const [selectedAudienceId, setSelectedAudienceId] = useState(initialAudienceId);
  const [sequenceSteps, setSequenceSteps] = useState<SequenceStepItem[]>([
    {
      id: 'step_1',
      type: 'SEND_EMAIL',
      config: { subject: '', body: '' }
    }
  ]);

  const [previewTemplateId, setPreviewTemplateId] = useState('');
  const [previewContactId, setPreviewContactId] = useState('');

  // Enrollment filter/search states
  const [enrollmentSearch, setEnrollmentSearch] = useState('');
  const [enrollmentStatusFilter, setEnrollmentStatusFilter] = useState('all');
  const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState<string[]>([]);

  // Pagination states
  const [campaignPage, setCampaignPage] = useState(1);
  const [campaignsPerPage] = useState(10);

  const [enrollmentPage, setEnrollmentPage] = useState(1);
  const [enrollmentsPerPage] = useState(10);

  const handleEnrollmentSearchChange = useCallback((val: string) => {
    setEnrollmentSearch(val);
    setEnrollmentPage(1);
  }, []);

  const handleEnrollmentStatusChange = useCallback((val: string) => {
    setEnrollmentStatusFilter(val);
    setEnrollmentPage(1);
  }, []);

  // ── Query Hooks ─────────────────────────────────────────────────────────

  const accountsQuery = useQuery({
    queryKey: ['email_accounts', workspaceId],
    queryFn: async () => {
      return window.ipc.invoke('email-accounts:list', undefined);
    },
    enabled: !!workspaceId
  });

  const templatesQuery = useQuery({
    queryKey: ['email_templates', workspaceId],
    queryFn: async () => {
      return window.ipc.invoke('templates:list', undefined);
    },
    enabled: !!workspaceId
  });

  const sequencesQuery = useQuery({
    queryKey: ['sequences', workspaceId],
    queryFn: async () => {
      return window.ipc.invoke('sequence:list', undefined);
    },
    enabled: !!workspaceId
  });

  const audiencesQuery = useQuery({
    queryKey: ['audiences', workspaceId],
    queryFn: async () => {
      return window.ipc.invoke('audiences:list', { workspaceId });
    },
    enabled: !!workspaceId
  });

  const campaignsQuery = useQuery({
    queryKey: ['campaigns', workspaceId],
    queryFn: async () => {
      return window.ipc.invoke('campaigns:list', { workspaceId });
    },
    enabled: !!workspaceId
  });

  const contactsQuery = useQuery({
    queryKey: ['contacts', 'list', workspaceId],
    queryFn: async () => {
      return window.ipc.invoke('contacts:list', { workspaceId });
    },
    enabled: !!workspaceId
  });

  // Query to fetch enrollments for detail page
  const enrollmentsQuery = useQuery({
    queryKey: ['campaign_enrollments', workspaceId, selectedCampaignId],
    queryFn: async () => {
      return window.ipc.invoke('campaigns:enrollments:list', {
        workspaceId,
        campaignId: selectedCampaignId
      });
    },
    enabled: !!workspaceId && !!selectedCampaignId
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
    enabled: !!previewTemplateId
  });

  // ── Mutation Hooks ──────────────────────────────────────────────────────

  const deleteAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      return window.ipc.invoke('email-accounts:delete', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email_accounts', workspaceId] });
    }
  });

  const verifyAccountMutation = useMutation({
    mutationFn: async (payload: { id: string; to: string; useSignature?: boolean }) => {
      return window.ipc.invoke('email-accounts:send-test', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email_accounts', workspaceId] });
      alert('Email Connection Verified successfully!');
    },
    onError: (err: any) => {
      alert(`Verification failed: ${err.message}`);
    }
  });

  const connectGmailOAuthMutation = useMutation({
    mutationFn: async () => {
      return window.ipc.invoke('email-accounts:gmail:connect', undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email_accounts', workspaceId] });
    },
    onError: (err: any) => {
      alert(`Google authorization failed.\n\n${err.message || 'Please try again.'}`);
    }
  });

  const reconnectGmailMutation = useMutation({
    mutationFn: async (id: string) => {
      return window.ipc.invoke('email-accounts:gmail:reconnect', { id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email_accounts', workspaceId] });
    },
    onError: (err: any) => {
      alert(`Google authorization failed.\n\n${err.message || 'Please try again.'}`);
    }
  });

  const disconnectGmailMutation = useMutation({
    mutationFn: async (id: string) => {
      return window.ipc.invoke('email-accounts:gmail:disconnect', { id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email_accounts', workspaceId] });
    },
    onError: (err: any) => {
      alert(`Disconnect failed: ${err.message}`);
    }
  });

  const sendTestEmailMutation = useMutation({
    mutationFn: async (payload: { id: string; to: string; useSignature?: boolean }) => {
      return window.ipc.invoke('email-accounts:send-test', payload);
    },
    onSuccess: (data: any) => {
      alert(`Test email sent to ${data?.sentTo || 'mailbox'}.`);
    },
    onError: (err: any) => {
      alert(`Test email failed: ${err.message}`);
    }
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
    }
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      return window.ipc.invoke('templates:delete', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email_templates', workspaceId] });
    }
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
    }
  });

  const updateCampaignStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return window.ipc.invoke('campaigns:update', { id, dto: { workspaceId, status } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] });
      queryClient.invalidateQueries({
        queryKey: ['campaign_enrollments', workspaceId, selectedCampaignId]
      });
    }
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      return window.ipc.invoke('campaigns:delete', { workspaceId, id });
    },
    onSuccess: () => {
      setSelectedCampaignId(null);
      queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] });
    }
  });

  // Enrollment Control Mutations
  const bulkPauseMutation = useMutation({
    mutationFn: async (enrollmentIds: string[]) => {
      return window.ipc.invoke('campaigns:bulk-pause-enrollments', {
        campaignId: selectedCampaignId,
        enrollmentIds
      });
    },
    onSuccess: () => {
      setSelectedEnrollmentIds([]);
      queryClient.invalidateQueries({
        queryKey: ['campaign_enrollments', workspaceId, selectedCampaignId]
      });
      queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] });
    }
  });

  const bulkResumeMutation = useMutation({
    mutationFn: async (enrollmentIds: string[]) => {
      return window.ipc.invoke('campaigns:bulk-resume-enrollments', {
        campaignId: selectedCampaignId,
        enrollmentIds
      });
    },
    onSuccess: () => {
      setSelectedEnrollmentIds([]);
      queryClient.invalidateQueries({
        queryKey: ['campaign_enrollments', workspaceId, selectedCampaignId]
      });
      queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] });
    }
  });

  const bulkRemoveMutation = useMutation({
    mutationFn: async (enrollmentIds: string[]) => {
      return window.ipc.invoke('campaigns:bulk-remove-enrollments', {
        campaignId: selectedCampaignId,
        enrollmentIds
      });
    },
    onSuccess: () => {
      setSelectedEnrollmentIds([]);
      queryClient.invalidateQueries({
        queryKey: ['campaign_enrollments', workspaceId, selectedCampaignId]
      });
      queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] });
    }
  });

  // Handlers
  const handleConnectGmailOAuth = () => {
    connectGmailOAuthMutation.mutate();
  };

  const handleCreateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    createTemplateMutation.mutate({
      name: tplName,
      subject: tplSubj,
      body: tplBody
    });
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campName.trim()) {
      toast.error('Please enter a valid Campaign Name before launching.');
      return;
    }
    if (!campAccId) {
      toast.error('Please select a connected Sender Email Account for outreach.');
      return;
    }
    if (!sequenceSteps || sequenceSteps.length === 0) {
      toast.error('Outreach campaign must contain at least 1 sequence step.');
      return;
    }

    // Step validation check (Section 31)
    for (let i = 0; i < sequenceSteps.length; i++) {
      const s = sequenceSteps[i];
      if (!s) continue;
      if (s.type === 'SEND_EMAIL') {
        if (!s.config.subject || !s.config.subject.trim()) {
          toast.error(`Step ${i + 1} (Email) is missing a Subject Line.`);
          return;
        }
        if (!s.config.body || !s.config.body.trim()) {
          toast.error(`Step ${i + 1} (Email) is missing a Message Body.`);
          return;
        }
      }
      if (s.type === 'WAIT' && (!s.config.delaySeconds || s.config.delaySeconds <= 0)) {
        toast.error(`Step ${i + 1} (Wait) must have a valid delay duration.`);
        return;
      }
    }

    try {
      let targetSeqId = campSeqId;

      // Build sequence dynamically from sequenceSteps if not reusing existing sequence
      if (!targetSeqId) {
        const formattedSteps: any[] = sequenceSteps.map((s, idx) => {
          const stepId = s?.id || `step_${idx + 1}`;
          const stepType = s?.type || 'SEND_EMAIL';
          const stepConfig = s?.config || {};

          if (stepType === 'IF') {
            return {
              id: stepId,
              type: 'IF',
              config: {
                condition: stepConfig.condition || "contact.status == 'REPLIED'",
                thenGoto: `label_yes_${idx}`,
                elseSkip: 1
              }
            };
          }
          return {
            id: stepId,
            type: stepType,
            config: stepConfig
          };
        });

        const seq = await window.ipc.invoke('sequence:create', {
          name: `Sequence: ${campName.trim()}`,
          status: 'ACTIVE',
          trigger: { type: 'MANUAL', config: {} },
          steps: formattedSteps
        });
        targetSeqId = seq.id;
      }

      // 2. Create Campaign
      const campaign = await window.ipc.invoke('campaigns:create', {
        workspaceId,
        name: campName.trim(),
        description: campDesc.trim() || undefined,
        sequenceId: targetSeqId,
        sendingAccountId: campAccId,
        dailyLimit: campLimit,
        timezone: campTimezone,
        status: 'Active'
      });

      // 3. Resolve Audience & Enroll Contacts
      let enrolledCount = 0;
      if (selectedAudienceId) {
        const resolved = await window.ipc.invoke('audiences:resolve', {
          workspaceId,
          id: selectedAudienceId
        });
        if (resolved.contactIds && resolved.contactIds.length > 0) {
          await window.ipc.invoke('campaigns:enroll', {
            campaignId: campaign.id,
            contactIds: resolved.contactIds
          });
          enrolledCount = resolved.contactIds.length;
        } else {
          toast.warning('Selected Audience resolved 0 active contacts. Campaign created as empty draft.');
        }
      }

      // 4. Trigger Scheduler
      await window.ipc.invoke('campaigns:schedule', campaign.id);

      queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['sequences', workspaceId] });
      setCampaignOpen(false);
      setCampName('');
      setCampDesc('');
      setCampSeqId('');
      setCampAccId('');
      setSelectedAudienceId('');
      setSequenceSteps([
        {
          id: 'step_1',
          type: 'SEND_EMAIL',
          config: { subject: '', body: '' }
        }
      ]);
      toast.success(
        enrolledCount > 0
          ? `Outreach campaign "${campName.trim()}" launched successfully with ${enrolledCount} contacts!`
          : `Outreach campaign "${campName.trim()}" created successfully!`
      );
    } catch (err: any) {
      toast.error(`Failed to launch campaign: ${err.message || err}`);
    }
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
        return (
          <Badge className="bg-success-muted text-success border border-success/20 text-[9px] font-bold px-2 rounded-none">
            Active
          </Badge>
        );
      case 'Paused':
        return (
          <Badge className="bg-warning-muted text-warning border border-warning/20 text-[9px] font-semibold px-2 rounded-none">
            Paused
          </Badge>
        );
      case 'Completed':
        return (
          <Badge className="bg-info-muted text-info border border-info/20 text-[9px] font-semibold px-2 rounded-none">
            Completed
          </Badge>
        );
      case 'Archived':
        return (
          <Badge className="bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 text-[9px] font-semibold px-2 rounded-none">
            Archived
          </Badge>
        );
      default:
        return (
          <Badge className="bg-muted-muted text-muted-foreground border border-border-subtle text-[9px] font-semibold px-2 rounded-none">
            Draft
          </Badge>
        );
    }
  };

  const getEnrollmentStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'running':
      case 'queued':
      case 'starting':
        return (
          <Badge className="bg-info-muted text-info border border-info/20 animate-pulse text-[9px] rounded-none">
            Running
          </Badge>
        );
      case 'waiting':
        return (
          <Badge className="bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 text-[9px] rounded-none">
            Waiting
          </Badge>
        );
      case 'paused':
        return (
          <Badge className="bg-warning-muted text-warning border border-warning/20 text-[9px] rounded-none">
            Paused
          </Badge>
        );
      case 'replied':
        return (
          <Badge className="bg-success-muted text-success border border-success/20 text-[9px] font-bold rounded-none">
            Replied
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-danger-muted text-danger border border-danger/20 text-[9px] font-bold rounded-none">
            Failed
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-success-muted text-success border border-success/20 text-[9px] font-bold rounded-none">
            Completed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[9px] rounded-none">
            {status}
          </Badge>
        );
    }
  };

  // Pagination calculation: Campaigns list
  const totalCampaigns = campaigns.length;
  const totalCampaignPages = Math.ceil(totalCampaigns / campaignsPerPage);
  const adjustedCampaignPage = Math.min(Math.max(1, campaignPage), totalCampaignPages || 1);
  const campaignStartIndex = (adjustedCampaignPage - 1) * campaignsPerPage;
  const paginatedCampaigns = campaigns.slice(campaignStartIndex, campaignStartIndex + campaignsPerPage);

  // Pagination calculation: Enrollments list
  const totalEnrollments = filteredEnrollments.length;
  const totalEnrollmentPages = Math.ceil(totalEnrollments / enrollmentsPerPage);
  const adjustedEnrollmentPage = Math.min(Math.max(1, enrollmentPage), totalEnrollmentPages || 1);
  const enrollmentStartIndex = (adjustedEnrollmentPage - 1) * enrollmentsPerPage;
  const paginatedEnrollments = filteredEnrollments.slice(enrollmentStartIndex, enrollmentStartIndex + enrollmentsPerPage);

  return (
    <div className="space-y-6 text-xs font-sans h-full overflow-y-auto pr-1">
      <PageHeader
        title="Outreach Platform"
        description="Manage Gmail senders, campaign lists, automated schedules, and follow-ups."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <div className="border-b border-border-subtle flex gap-4 w-full relative mb-4">
        {[
          { id: 'campaigns', label: 'Campaigns', Icon: Megaphone },
          { id: 'monitor', label: 'Queue Monitor', Icon: Activity },
          { id: 'templates', label: 'Templates', Icon: FileText }
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
                  layoutId="campaignActiveTabUnderline"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary"
                  transition={{ type: 'spring', stiffness: 550, damping: 38 }}
                />
              )}
            </button>
          );
        })}
      </div>

        {/* ── CAMPAIGNS TAB (LIST VIEW OR DETAIL VIEW) ──────────────────────── */}
        <TabsContent value="campaigns" className="mt-4 space-y-4">
          {!selectedCampaignId ? (
            /* ──── LIST OF CAMPAIGNS ──── */
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-foreground text-[11px]">
                  Outbound Campaigns
                </span>
                <Button
                  onClick={() => setCampaignOpen(true)}
                  size="sm"
                  className="flex items-center gap-1 rounded-none"
                >
                  <Plus className="h-3 w-3" />
                  Launch Campaign
                </Button>
              </div>

              {campaigns.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.25 }}
                  className="h-[280px] flex items-center justify-center p-6 bg-card border border-border-subtle border-dashed rounded-none"
                >
                  <div className="max-w-md w-full flex flex-col items-center text-center space-y-4">
                    <motion.div
                      animate={{ y: [0, -6, 0] }}
                      transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                      className="w-12 h-12 rounded-none bg-primary/10 flex items-center justify-center text-primary border border-primary/20"
                    >
                      <Megaphone className="h-6 w-6" />
                    </motion.div>
                    <div>
                      <h3 className="text-xs font-semibold text-foreground">No outbound campaigns launched</h3>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Define campaign sequences, connect Gmail senders, and start reaching prospects.
                      </p>
                    </div>
                    <Button onClick={() => setCampaignOpen(true)} size="sm" className="rounded-none">
                      + Launch Campaign
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <div className="bg-card border border-border-subtle rounded-none overflow-hidden shadow-sm flex flex-col justify-between">
                  <Table>
                    <TableHeader className="bg-surface-3/40">
                      <TableRow>
                        <TableHead>Campaign Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Sequence</TableHead>
                        <TableHead>Sender Account</TableHead>
                        <TableHead className="text-center">Enrolled</TableHead>
                        <TableHead className="text-center text-info">Running</TableHead>
                        <TableHead className="text-center text-zinc-400">Waiting</TableHead>
                        <TableHead className="text-center text-success">Replies</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <motion.tbody
                      initial="hidden"
                      animate="visible"
                      variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
                    >
                      {paginatedCampaigns.map((camp: any) => {
                        const sequence = sequences.find((s: any) => s.id === camp.sequenceId);
                        const account = accounts.find((a: any) => a.id === camp.sendingAccountId);
                        return (
                          <motion.tr
                            key={camp.id}
                            variants={{
                              hidden: { opacity: 0, y: 8 },
                              visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] } }
                            }}
                            className="hover:bg-surface-3/10 cursor-pointer border-b border-border-subtle/50 text-xs"
                            onClick={() => {
                              setSelectedCampaignId(camp.id);
                              setEnrollmentPage(1);
                            }}
                          >
                            <TableCell className="font-semibold text-foreground py-3">
                              {camp.name}
                              <span className="block text-[10px] text-muted-foreground font-normal mt-0.5">
                                {camp.description || 'No description provided.'}
                              </span>
                            </TableCell>
                            <TableCell>{getCampaignStatusBadge(camp.status)}</TableCell>
                            <TableCell>{sequence?.name || '—'}</TableCell>
                            <TableCell className="font-mono">{account?.email || '—'}</TableCell>
                            <TableCell className="text-center font-mono font-bold">
                              {camp.contactsCount || 0}
                            </TableCell>
                            <TableCell className="text-center font-mono text-info">
                              {camp.runningCount || 0}
                            </TableCell>
                            <TableCell className="text-center font-mono text-zinc-400">
                              {camp.waitingCount || 0}
                            </TableCell>
                            <TableCell className="text-center font-mono text-success">
                              {camp.repliedCount || 0}
                            </TableCell>
                            <TableCell
                              className="text-right py-3"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex justify-end gap-1.5">
                                {camp.status === 'Paused' || camp.status === 'Draft' ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      updateCampaignStatusMutation.mutate({
                                        id: camp.id,
                                        status: 'Active'
                                      })
                                    }
                                    className="h-7 text-success hover:bg-success-muted gap-0.5 rounded-none"
                                  >
                                    <Play className="h-3 w-3" />
                                    Resume
                                  </Button>
                                ) : camp.status === 'Active' ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      updateCampaignStatusMutation.mutate({
                                        id: camp.id,
                                        status: 'Paused'
                                      })
                                    }
                                    className="h-7 text-warning hover:bg-warning-muted gap-0.5 rounded-none"
                                  >
                                    <Pause className="h-3 w-3" />
                                    Pause
                                  </Button>
                                ) : null}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (
                                      confirm(
                                        'Are you sure you want to delete this campaign? All enrollments will be deleted.'
                                      )
                                    ) {
                                      deleteCampaignMutation.mutate(camp.id);
                                    }
                                  }}
                                  className="h-7 text-danger hover:bg-danger-muted rounded-none"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </motion.tr>
                        );
                      })}
                    </motion.tbody>
                  </Table>
                </div>
              )}

              {/* Campaigns list pagination controls */}
              {totalCampaignPages > 1 && campaigns.length > 0 && (
                <div className="flex items-center justify-between border-t border-border-subtle pt-4 mt-2 select-none">
                  <span className="text-[11px] text-muted-foreground">
                    Showing{' '}
                    <strong className="text-foreground font-mono">{campaignStartIndex + 1}</strong>{' '}
                    to{' '}
                    <strong className="text-foreground font-mono">
                      {Math.min(campaignStartIndex + campaignsPerPage, totalCampaigns)}
                    </strong>{' '}
                    of <strong className="text-foreground font-mono">{totalCampaigns}</strong> campaigns
                  </span>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setCampaignPage((p) => Math.max(1, p - 1));
                      }}
                      disabled={adjustedCampaignPage === 1}
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
                        setCampaignPage((p) => Math.min(totalCampaignPages, p + 1));
                      }}
                      disabled={adjustedCampaignPage === totalCampaignPages}
                      className="h-8 rounded-none px-3 text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
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
                      className="gap-1 h-8 text-[11px] rounded-none"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Back to Campaigns
                    </Button>

                    <div className="flex items-center gap-2">
                      {campaign.status === 'Active' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateCampaignStatusMutation.mutate({
                              id: campaign.id,
                              status: 'Paused'
                            })
                          }
                          className="h-8 text-[10px] text-warning border-warning/20 gap-1 hover:bg-warning-muted rounded-none"
                        >
                          <Pause className="h-3.5 w-3.5" />
                          Pause Campaign
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateCampaignStatusMutation.mutate({
                              id: campaign.id,
                              status: 'Active'
                            })
                          }
                          className="h-8 text-[10px] text-success border-success/20 gap-1 hover:bg-success-muted rounded-none"
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
                            updateCampaignStatusMutation.mutate({
                              id: campaign.id,
                              status: 'Archived'
                            });
                          }
                        }}
                        className="h-8 text-[10px] text-zinc-400 gap-1 rounded-none"
                      >
                        <Archive className="h-3.5 w-3.5" />
                        Archive
                      </Button>
                    </div>
                  </div>

                  {/* Campaign Info Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-card border border-border-subtle rounded-none p-3.5 space-y-1">
                      <span className="text-[10px] text-muted-foreground">Campaign Status</span>
                      <div className="flex items-center justify-between">
                        <span className="text-base font-bold text-foreground">{campaign.name}</span>
                        {getCampaignStatusBadge(campaign.status)}
                      </div>
                      <span className="block text-[9px] text-muted-foreground mt-0.5">
                        {campaign.description || '—'}
                      </span>
                    </div>

                    <div className="bg-card border border-border-subtle rounded-none p-3.5 space-y-1">
                      <span className="text-[10px] text-muted-foreground">Active Sequence</span>
                      <div className="text-xs font-bold text-foreground truncate flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5 text-primary" />
                        {sequence?.name || '—'}
                      </div>
                      <span className="block text-[9px] text-muted-foreground">
                        Steps: {sequence?.steps ? (typeof sequence.steps === 'string' ? JSON.parse(sequence.steps).length : sequence.steps.length) : 0} steps
                      </span>
                    </div>

                    <div className="bg-card border border-border-subtle rounded-none p-3.5 space-y-1">
                      <span className="text-[10px] text-muted-foreground">Sender Account</span>
                      <div className="text-xs font-bold text-foreground truncate flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5 text-primary" />
                        {account?.name || '—'}
                      </div>
                      <span className="block text-[9px] text-muted-foreground truncate font-mono">
                        {account?.email || '—'}
                      </span>
                    </div>

                    <div className="bg-card border border-border-subtle rounded-none p-3.5 space-y-1">
                      <span className="text-[10px] text-muted-foreground">Delivery Limits</span>
                      <div className="text-xs font-bold text-foreground font-mono">
                        {campaign.dailyLimit || 200} daily / {campaign.timezone || 'UTC'}
                      </div>
                      <span className="block text-[9px] text-muted-foreground">
                        Workspace local settings apply
                      </span>
                    </div>
                  </div>

                  {/* Campaign Dashboard Stats */}
                  <div className="grid grid-cols-7 gap-2 bg-surface-3 border border-border-subtle rounded-none p-3.5">
                    <div className="text-center border-r border-border-subtle/50">
                      <span className="block font-mono text-base font-bold text-foreground">
                        {campaign.contactsCount || 0}
                      </span>
                      <span className="text-[9px] text-muted-foreground">Enrolled</span>
                    </div>
                    <div className="text-center border-r border-border-subtle/50">
                      <span className="block font-mono text-base font-bold text-info">
                        {campaign.runningCount || 0}
                      </span>
                      <span className="text-[9px] text-muted-foreground">Running</span>
                    </div>
                    <div className="text-center border-r border-border-subtle/50">
                      <span className="block font-mono text-base font-bold text-zinc-400">
                        {campaign.waitingCount || 0}
                      </span>
                      <span className="text-[9px] text-muted-foreground">Waiting</span>
                    </div>
                    <div className="text-center border-r border-border-subtle/50">
                      <span className="block font-mono text-base font-bold text-success">
                        {campaign.repliedCount || 0}
                      </span>
                      <span className="text-[9px] text-muted-foreground">Replies</span>
                    </div>
                    <div className="text-center border-r border-border-subtle/50">
                      <span className="block font-mono text-base font-bold text-success">
                        {campaign.completedCount || 0}
                      </span>
                      <span className="text-[9px] text-muted-foreground">Completed</span>
                    </div>
                    <div className="text-center border-r border-border-subtle/50">
                      <span className="block font-mono text-base font-bold text-warning">
                        {campaign.pausedCount || 0}
                      </span>
                      <span className="text-[9px] text-muted-foreground">Paused</span>
                    </div>
                    <div className="text-center">
                      <span className="block font-mono text-base font-bold text-danger">
                        {campaign.failedCount || 0}
                      </span>
                      <span className="text-[9px] text-muted-foreground">Failed</span>
                    </div>
                  </div>

                  {/* Main detail workflow section: Left Enrollment Table, Right Timeline Stepper */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Enrollment Table Column */}
                    <div className="lg:col-span-2 space-y-3 bg-card border border-border-subtle rounded-none p-4 shadow-sm">
                      <div className="flex justify-between items-center gap-2">
                        <h4 className="font-semibold text-foreground text-[11px] flex items-center gap-1.5">
                          <Users className="h-4 w-4 text-primary" />
                          Enrolled Recipient Leads
                        </h4>

                        {/* Search and filter toolbar */}
                        <div className="flex gap-2">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground opacity-60" />
                            <Input
                              placeholder="Search leads..."
                              value={enrollmentSearch}
                              onChange={(e) => handleEnrollmentSearchChange(e.target.value)}
                              className="pl-8 h-7 text-[10px] w-40 rounded-none border-border-subtle bg-card"
                            />
                          </div>
                          <select
                            value={enrollmentStatusFilter}
                            onChange={(e) => handleEnrollmentStatusChange(e.target.value)}
                            className="h-7 text-[10px] bg-background border border-border-subtle rounded-none px-1.5 focus-visible:outline-none"
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
                        <div className="flex items-center justify-between bg-surface-3 border border-border-subtle rounded-none p-2.5 text-[10px]">
                          <span className="font-semibold text-foreground">
                            {selectedEnrollmentIds.length} lead(s) selected
                          </span>
                          <div className="flex gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => bulkResumeMutation.mutate(selectedEnrollmentIds)}
                              className="h-6 text-[9px] px-2 text-success rounded-none hover:bg-success-muted"
                            >
                              Resume
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => bulkPauseMutation.mutate(selectedEnrollmentIds)}
                              className="h-6 text-[9px] px-2 text-warning rounded-none hover:bg-warning-muted"
                            >
                              Pause
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (
                                  confirm(
                                    `Remove ${selectedEnrollmentIds.length} lead(s) from campaign?`
                                  )
                                ) {
                                  bulkRemoveMutation.mutate(selectedEnrollmentIds);
                                }
                              }}
                              className="h-6 text-[9px] px-2 text-danger rounded-none hover:bg-danger-muted"
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Enrolled Leads Table */}
                      <div className="border border-border-subtle rounded-none overflow-hidden flex flex-col justify-between">
                        <Table>
                          <TableHeader className="bg-surface-3/40">
                            <TableRow>
                              <TableHead className="w-8 py-2">
                                <input
                                  type="checkbox"
                                  checked={
                                    selectedEnrollmentIds.length === paginatedEnrollments.length &&
                                    paginatedEnrollments.length > 0
                                  }
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedEnrollmentIds(
                                        paginatedEnrollments.map((x: any) => x.id)
                                      );
                                    } else {
                                      setSelectedEnrollmentIds([]);
                                    }
                                  }}
                                  className="rounded-none border-border-subtle text-primary focus:ring-ring"
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
                            {paginatedEnrollments.map((enroll: any) => {
                              const isChecked = selectedEnrollmentIds.includes(enroll.id);
                              const nextRun = enroll.nextExecutionAt
                                ? formatDistanceToNow(new Date(enroll.nextExecutionAt))
                                : '—';
                              return (
                                <TableRow
                                  key={enroll.id}
                                  className={`hover:bg-surface-3/15 cursor-pointer ${
                                    selectedEnrollment?.id === enroll.id ? 'bg-primary/12' : ''
                                  }`}
                                  onClick={() => setSelectedEnrollment(enroll)}
                                >
                                  <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedEnrollmentIds([
                                            ...selectedEnrollmentIds,
                                            enroll.id
                                          ]);
                                        } else {
                                          setSelectedEnrollmentIds(
                                            selectedEnrollmentIds.filter((x) => x !== enroll.id)
                                          );
                                        }
                                      }}
                                      className="rounded-none border-border-subtle text-primary focus:ring-ring"
                                    />
                                  </TableCell>
                                  <TableCell className="py-2">
                                    <div className="font-semibold text-foreground">
                                      {enroll.firstName} {enroll.lastName || ''}
                                    </div>
                                    <span className="block text-[9px] font-mono text-primary truncate max-w-[120px]">
                                      {enroll.email}
                                    </span>
                                  </TableCell>
                                  <TableCell className="py-2 font-mono text-[10px] text-muted-foreground">
                                    {nextRun}
                                  </TableCell>
                                  <TableCell className="py-2">
                                    {getEnrollmentStatusBadge(enroll.status)}
                                  </TableCell>
                                  <TableCell className="py-2 text-center font-mono font-bold">
                                    {enroll.emailsSentCount || 0}
                                  </TableCell>
                                  <TableCell
                                    className="py-2 text-right"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        if (confirm('Remove lead from this campaign?')) {
                                          bulkRemoveMutation.mutate([enroll.id]);
                                        }
                                      }}
                                      className="h-6 w-6 p-0 text-danger hover:bg-danger-muted rounded-none"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Enrollment table pagination controls */}
                      {totalEnrollmentPages > 1 && (
                        <div className="flex items-center justify-between border-t border-border-subtle pt-4 mt-2 select-none">
                          <span className="text-[11px] text-muted-foreground">
                            Showing{' '}
                            <strong className="text-foreground font-mono">{enrollmentStartIndex + 1}</strong>{' '}
                            to{' '}
                            <strong className="text-foreground font-mono">
                              {Math.min(enrollmentStartIndex + enrollmentsPerPage, totalEnrollments)}
                            </strong>{' '}
                            of <strong className="text-foreground font-mono">{totalEnrollments}</strong> leads
                          </span>

                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEnrollmentPage((p) => Math.max(1, p - 1));
                              }}
                              disabled={adjustedEnrollmentPage === 1}
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
                                setEnrollmentPage((p) => Math.min(totalEnrollmentPages, p + 1));
                              }}
                              disabled={adjustedEnrollmentPage === totalEnrollmentPages}
                              className="h-8 rounded-none px-3 text-[11px] font-semibold transition-colors cursor-pointer"
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Stepper Details Column */}
                    <div className="bg-card border border-border-subtle rounded-none p-4 shadow-sm space-y-4">
                      <h4 className="font-semibold text-foreground text-[11px] flex items-center gap-1.5 pb-2 border-b border-border-subtle">
                        <Activity className="h-4 w-4 text-primary" />
                        Execution Telemetry Stream
                      </h4>

                      {selectedEnrollment ? (
                        <div className="space-y-4">
                          <div>
                            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">
                              Selected Recipient
                            </span>
                            <div className="font-bold text-foreground text-xs mt-0.5">
                              {selectedEnrollment.firstName} {selectedEnrollment.lastName || ''}
                            </div>
                            <span className="text-[10px] font-mono text-primary block mt-0.5">
                              {selectedEnrollment.email}
                            </span>
                            {selectedEnrollment.companyName && (
                              <span className="text-[10px] text-muted-foreground block mt-0.5 truncate">
                                Firm: {selectedEnrollment.companyName}
                              </span>
                            )}
                          </div>

                          <div className="space-y-1">
                            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">
                              Sequence Progress
                            </span>
                            <div className="text-[11px] font-medium text-foreground flex items-center gap-2">
                              {getEnrollmentStatusBadge(selectedEnrollment.status)}
                              <span className="font-mono">
                                Step {selectedEnrollment.currentStepIndex || 0} of{' '}
                                {sequence?.steps ? (typeof sequence.steps === 'string' ? JSON.parse(sequence.steps).length : sequence.steps.length) : 0}
                              </span>
                            </div>
                            {selectedEnrollment.status === 'replied' && (
                              <p className="text-[9px] text-success font-semibold flex items-center gap-0.5 mt-1 bg-success-muted border border-success/15 px-2 py-1">
                                <CheckCircle className="h-3 w-3" />
                                Sequence stopped because recipient replied!
                              </p>
                            )}
                            {selectedEnrollment.status === 'failed' && (
                              <p className="text-[9px] text-danger font-semibold flex items-center gap-0.5 mt-1 bg-danger-muted border border-danger/15 px-2 py-1">
                                <AlertCircle className="h-3 w-3" />
                                Send failed: check SMTP credentials or connection logs.
                              </p>
                            )}
                          </div>

                          {/* Raw logs output */}
                          <div className="space-y-1.5 pt-3 border-t border-border-subtle">
                            <span className="block font-semibold text-foreground text-[10px]">
                              Technical Audit Logs:
                            </span>
                            <div className="bg-surface-3 border border-border-subtle rounded-none p-2.5 font-mono text-[9px] max-h-40 overflow-y-auto space-y-1 text-muted-foreground">
                              {selectedEnrollment.logs && selectedEnrollment.logs.length > 0 ? (
                                selectedEnrollment.logs.map((log: any, idx: number) => (
                                  <div
                                    key={idx}
                                    className="border-b border-border-subtle/30 pb-1 last:border-0 last:pb-0"
                                  >
                                    <span className="text-zinc-500">
                                      [{new Date(log.timestamp).toLocaleTimeString()}]
                                    </span>{' '}
                                    <span className="text-foreground font-semibold">
                                      {log.action || 'Log'}:
                                    </span>{' '}
                                    {log.message}
                                  </div>
                                ))
                              ) : (
                                <div className="text-center py-2 italic text-zinc-500">
                                  No telemetry log entries.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-10 text-muted-foreground italic">
                          Select a contact from the leads table to view their execution timeline
                          stepper.
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
            <Button
              onClick={() => setTemplateOpen(true)}
              size="sm"
              className="flex items-center gap-1 rounded-none"
            >
              <Plus className="h-3 w-3" />
              Create Template
            </Button>
          </div>

          {templates.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center p-6 bg-card border border-border-subtle border-dashed rounded-none">
              <div className="max-w-md w-full flex flex-col items-center text-center space-y-4">
                <div className="w-12 h-12 rounded-none bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-foreground">No email templates found</h3>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Draft merge copy templates with dynamic variables like {`{{firstName}}`} or {`{{company}}`}.
                  </p>
                </div>
                <Button onClick={() => setTemplateOpen(true)} size="sm" className="rounded-none">
                  + Create Template
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((tpl: any) => (
                <div
                  key={tpl.id}
                  className="bg-card border border-border-subtle rounded-none p-4 space-y-3 shadow-sm hover:shadow-md transition"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-foreground text-xs">{tpl.name}</h4>
                      <span className="block text-[10px] text-muted-foreground truncate max-w-xs mt-0.5 font-mono">
                        Subject: {tpl.subject}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setPreviewTemplateId(tpl.id);
                          setPreviewOpen(true);
                        }}
                        className="h-7 text-[10px] gap-0.5 rounded-none"
                      >
                        <Eye className="h-3 w-3" />
                        Preview
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteTemplateMutation.mutate(tpl.id)}
                        className="h-7 w-7 p-0 text-danger hover:bg-danger-muted rounded-none"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="bg-surface-3 border border-border-subtle rounded-none p-2.5 font-mono text-[10px] text-muted-foreground max-h-24 overflow-y-auto whitespace-pre-wrap">
                    {tpl.body}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>



      {/* ── Create Template Dialog ───────────────────────────────────────── */}
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="max-w-md rounded-none bg-background border border-border-subtle shadow-elevation-2">
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
                className="rounded-none bg-card border-border-subtle"
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
                className="rounded-none bg-card border-border-subtle"
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
                className="rounded-none bg-card border-border-subtle"
              />
              <p className="text-[9px] text-muted-foreground mt-0.5">
                Merge variables:{' '}
                <code className="font-mono bg-surface-3 px-1 rounded-none border border-border-subtle">{`{{firstName}}`}</code>,{' '}
                <code className="font-mono bg-surface-3 px-1 rounded-none border border-border-subtle">{`{{lastName}}`}</code>,{' '}
                <code className="font-mono bg-surface-3 px-1 rounded-none border border-border-subtle">{`{{company}}`}</code>,{' '}
                <code className="font-mono bg-surface-3 px-1 rounded-none border border-border-subtle">{`{{website}}`}</code>
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
              <Button type="button" variant="secondary" className="rounded-none" onClick={() => setTemplateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="rounded-none" disabled={createTemplateMutation.isPending}>
                Save Template
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Launch Campaign Dialog ───────────────────────────────────────── */}
      <Dialog open={campaignOpen} onOpenChange={setCampaignOpen}>
        <DialogContent className="max-w-xl rounded-none bg-card border border-border-subtle shadow-elevation-2 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold text-sm">
              <Megaphone className="w-4 h-4 text-primary" />
              Launch Outreach Campaign
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateCampaign} className="space-y-4">
            {/* Section 1: Target Audience */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-foreground uppercase tracking-wider font-mono border-b border-border-subtle pb-1 flex items-center justify-between">
                <span>1. Target Audience</span>
                {selectedAudienceId && (
                  <Badge className="bg-primary/10 text-primary border border-primary/20 text-[9px] rounded-none">
                    Audience Selected
                  </Badge>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="campAudience" className="text-xs">Select Target Audience Segment</Label>
                <select
                  id="campAudience"
                  value={selectedAudienceId}
                  onChange={(e) => setSelectedAudienceId(e.target.value)}
                  className="w-full h-8 px-2 bg-surface-3 border border-border-subtle rounded-none text-xs text-foreground focus-visible:outline-none font-sans"
                >
                  <option value="">-- All Active Contacts --</option>
                  {((audiencesQuery.data || []) as any[]).map((aud: any) => (
                    <option key={aud.id} value={aud.id}>
                      {`${aud.name} (${aud.contactCount || 0} contacts • ${aud.mode?.toUpperCase() || 'DYNAMIC'})`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Section 2: Campaign Details */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-foreground uppercase tracking-wider font-mono border-b border-border-subtle pb-1">
                2. Campaign Details
              </div>
              <div className="space-y-1">
                <Label htmlFor="campName" className="text-xs">Campaign Name <span className="text-danger">*</span></Label>
                <Input
                  id="campName"
                  placeholder="e.g. Q4 SaaS Leads Outreach"
                  value={campName}
                  onChange={(e) => setCampName(e.target.value)}
                  required
                  className="rounded-none bg-surface-3 border-border-subtle text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="campDesc" className="text-xs">Description</Label>
                <Input
                  id="campDesc"
                  placeholder="Target audience and campaign goals..."
                  value={campDesc}
                  onChange={(e) => setCampDesc(e.target.value)}
                  className="rounded-none bg-surface-3 border-border-subtle text-xs"
                />
              </div>
            </div>

            {/* Section 3: Outreach Sequence Builder */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-foreground uppercase tracking-wider font-mono border-b border-border-subtle pb-1 flex items-center justify-between">
                <span>3. Outreach Sequence</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  {sequenceSteps.length} step(s) configured
                </span>
              </div>

              <ProgressiveSequenceEditor
                steps={sequenceSteps}
                onChange={setSequenceSteps}
                templates={templates}
              />
            </div>

            {/* Section 4: Sender & Schedule Settings */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-foreground uppercase tracking-wider font-mono border-b border-border-subtle pb-1">
                4. Sender & Schedule Settings
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="campAcc" className="text-xs">Sender Email Account <span className="text-danger">*</span></Label>
                  {accountsQuery.isError && (
                    <button
                      type="button"
                      onClick={() => accountsQuery.refetch()}
                      className="text-[10px] text-danger hover:underline font-mono"
                    >
                      Retry Loading
                    </button>
                  )}
                </div>

                <select
                  id="campAcc"
                  value={campAccId}
                  onChange={(e) => setCampAccId(e.target.value)}
                  className="w-full h-8 px-2 bg-surface-3 border border-border-subtle rounded-none text-xs text-foreground focus-visible:outline-none"
                  required
                  disabled={accountsQuery.isLoading}
                >
                  {accountsQuery.isLoading ? (
                    <option value="">Loading sender accounts...</option>
                  ) : accountsQuery.isError ? (
                    <option value="">Unable to load sender accounts. Retry above.</option>
                  ) : accounts.length === 0 ? (
                    <option value="">No sender accounts connected. Connect Gmail in Settings → Integrations.</option>
                  ) : (
                    <>
                      <option value="">-- Select Sender Account --</option>
                      {accounts.map((acc: any) => (
                        <option key={acc.id} value={acc.id}>
                          {`${acc.name || 'Gmail Account'} (${acc.email || acc.id})`}
                        </option>
                      ))}
                    </>
                  )}
                </select>

                {!accountsQuery.isLoading && accounts.length === 0 && (
                  <p className="text-[10px] text-warning mt-1 flex items-center gap-1 font-mono">
                    ⚠️ No connected senders. Go to Settings → Integrations to link a Gmail account.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="campLimit" className="text-xs">Daily Limit</Label>
                  <Input
                    id="campLimit"
                    type="number"
                    value={campLimit}
                    onChange={(e) => setCampLimit(parseInt(e.target.value) || 200)}
                    required
                    className="rounded-none bg-surface-3 border-border-subtle font-mono text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="campTz" className="text-xs">Timezone</Label>
                  <Input
                    id="campTz"
                    value={campTimezone}
                    onChange={(e) => setCampTimezone(e.target.value)}
                    required
                    className="rounded-none bg-surface-3 border-border-subtle text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Section 5: Review & Safety Summary */}
            <div className="bg-surface-3/60 border border-border-subtle rounded-none p-3 space-y-2">
              <div className="text-[10px] font-bold text-foreground uppercase tracking-wider font-mono flex items-center gap-1 text-primary">
                <CheckCircle className="w-3.5 h-3.5" /> Launch Review Summary
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-muted-foreground">
                <div>
                  <span className="text-foreground font-semibold">Audience:</span>{' '}
                  {selectedAudienceId
                    ? ((audiencesQuery.data || []) as any[]).find((a) => a.id === selectedAudienceId)?.name || 'Selected'
                    : 'All Active Contacts'}
                </div>
                <div>
                  <span className="text-foreground font-semibold">Steps:</span> {sequenceSteps.length} step(s)
                </div>
                <div>
                  <span className="text-foreground font-semibold">Sender:</span>{' '}
                  {accounts.find((a: any) => a.id === campAccId)?.email || 'None selected'}
                </div>
                <div>
                  <span className="text-foreground font-semibold">Daily Limit:</span> {campLimit} emails/day
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
              <Button type="button" variant="secondary" className="rounded-none" onClick={() => setCampaignOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="rounded-none gap-1.5 font-semibold">
                <Megaphone className="w-3.5 h-3.5" />
                Launch Outreach
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Live Preview Drawer Dialog ────────────────────────────────────── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md rounded-none bg-background border border-border-subtle shadow-elevation-2">
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
                className="w-full h-8 px-2 bg-background border border-border-subtle rounded-none text-xs focus-visible:outline-none"
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
              <div className="text-center py-4 text-muted-foreground animate-pulse">Compiling template...</div>
            ) : previewQuery.data ? (
              <div className="border border-border-subtle rounded-none p-3 bg-surface-3 space-y-2 font-mono text-[10px]">
                <div className="font-bold text-foreground">
                  Subject:{' '}
                  <span className="font-normal font-sans text-muted-foreground">
                    {previewQuery.data.subject}
                  </span>
                </div>
                <div className="border-t border-border-subtle pt-2 text-foreground font-sans whitespace-pre-wrap">
                  {previewQuery.data.body}
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-2">
              <Button className="rounded-none" onClick={() => setPreviewOpen(false)}>Close Preview</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
