import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '../hooks/useWorkspace';
import { Tabs, TabsContent } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import {
  useSequences,
  useSequenceExecutions,
  useStartSequence,
  useStopSequence
} from '../hooks/use-automation';
import {
  Play,
  StopCircle,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Clock,
  Mail,
  Tag,
  FileText,
  UserCheck,
  CheckCircle,
  AlertCircle,
  Zap,
  Activity,
  History,
  Download,
  FolderOpen,
  Bell,
  Search,
  Globe,
  Sparkles,
  Layers
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/common/PageHeader';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * AutomationScreen — sequence card builder, triggers, and execution telemetry flow.
 *
 * Design updates:
 *   - Squared corners: all buttons, dialog contents, selects, textareas, inputs, badges, and progress rails use rounded-none.
 *   - Correct Palette: matches primary, info, success, warning, danger.
 *   - Sliding Underline Tab Switcher: Framer Motion animated tab bar with snappy spring physics.
 *   - Double Table Pagination: pagination controls on Templates list and Executions monitor tables.
 *   - Stable Callback references.
 */
export default function AutomationScreen() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || '';
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [editorOpen, setEditorOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);

  // Builder States
  const [editingSequenceId, setEditingSequenceId] = useState<string | null>(null);
  const [seqName, setSeqName] = useState('');
  const [seqDesc, setSeqDesc] = useState('');
  const [seqTriggerType, setSeqTriggerType] = useState('CONTACT_CREATED');
  const [seqStatus, setSeqStatus] = useState('DRAFT');
  const [seqSteps, setSeqSteps] = useState<any[]>([]);

  // Pagination states
  const [templatesPage, setTemplatesPage] = useState(1);
  const [templatesPerPage] = useState(10);

  const [executionsPage, setExecutionsPage] = useState(1);
  const [executionsPerPage] = useState(10);

  const handleTemplatesPageChange = useCallback((page: number) => {
    setTemplatesPage(page);
  }, []);

  const handleExecutionsPageChange = useCallback((page: number) => {
    setExecutionsPage(page);
  }, []);

  // ── Query Hooks ─────────────────────────────────────────────────────────

  const sequencesQuery = useSequences();
  const executionsQuery = useSequenceExecutions();
  const startSequenceMutation = useStartSequence();
  const stopSequenceMutation = useStopSequence();

  const logsQuery = useQuery({
    queryKey: ['sequence_logs', selectedExecutionId],
    queryFn: async () => {
      if (!selectedExecutionId) return [];
      return window.ipc.invoke('execution:logs', selectedExecutionId);
    },
    enabled: !!selectedExecutionId
  });

  const templatesQuery = useQuery({
    queryKey: ['email_templates', workspaceId],
    queryFn: async () => {
      return window.ipc.invoke('templates:list', undefined);
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

  // ── Mutations ────────────────────────────────────────────────────────────

  const saveSequenceMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: seqName,
        description: seqDesc,
        status: seqStatus,
        trigger: { type: seqTriggerType, config: {} },
        steps: seqSteps
      };

      if (editingSequenceId) {
        return window.ipc.invoke('sequence:update', { id: editingSequenceId, dto: payload });
      } else {
        return window.ipc.invoke('sequence:create', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequences', 'list', workspaceId] });
      toast.success(
        editingSequenceId ? 'Sequence updated successfully.' : 'Sequence created successfully.'
      );
      setEditorOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save sequence.');
    }
  });

  const deleteSequenceMutation = useMutation({
    mutationFn: async (id: string) => {
      return window.ipc.invoke('sequence:delete', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequences', 'list', workspaceId] });
      toast.success('Sequence deleted.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete sequence.');
    }
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleOpenNewEditor = useCallback(() => {
    setEditingSequenceId(null);
    setSeqName('');
    setSeqDesc('');
    setSeqTriggerType('CONTACT_CREATED');
    setSeqStatus('DRAFT');
    setSeqSteps([]);
    setEditorOpen(true);
  }, []);

  const handleOpenEditEditor = useCallback((seq: any) => {
    setEditingSequenceId(seq.id);
    setSeqName(seq.name);
    setSeqDesc(seq.description || '');
    setSeqTriggerType(seq.trigger?.type || 'CONTACT_CREATED');
    setSeqStatus(seq.status);

    // Parse steps from string if cached locally as JSON string
    const parsedSteps = typeof seq.steps === 'string' ? JSON.parse(seq.steps) : seq.steps;
    setSeqSteps(parsedSteps || []);
    setEditorOpen(true);
  }, []);

  const handleAddStep = (type: string) => {
    const defaultStepConfigs: Record<string, any> = {
      WAIT: { delaySeconds: 60 },
      SEND_EMAIL: { templateId: '' },
      ASSIGN_TAG: { tag: '' },
      REMOVE_TAG: { tag: '' },
      CREATE_NOTE: { content: '' },
      MOVE_PIPELINE_STAGE: { stage: 'CONTACTED' },
      START_CAMPAIGN: { campaignId: '' },
      STOP_CAMPAIGN: { campaignId: '' },
      ASSIGN_OWNER: { ownerId: 'sales_rep_1' },
      CREATE_ACTIVITY: { type: 'automation', content: '' },
      FINISH_SEQUENCE: {},
      CONDITION: { conditionType: 'NO_REPLY_RECEIVED' },
      RUN_DISCOVERY: { query: '', limit: 50 },
      RUN_CRAWLER: { companyId: '', website: '' },
      RUN_INTELLIGENCE: { companyId: '' },
      GENERATE_AI_SUMMARY: { companyId: '' },
      GENERATE_OPENING_LINE: { companyId: '' },
      CREATE_CAMPAIGN: { name: '', subject: '', body: '' },
      ENROLL_CONTACT: { campaignId: '', contactId: '' },
      PAUSE_CAMPAIGN: { campaignId: '' },
      RESUME_CAMPAIGN: { campaignId: '' },
      SEND_NOTIFICATION: { message: '', type: 'info' },
      EXPORT_CSV: {},
      BACKUP_WORKSPACE: {}
    };

    setSeqSteps([
      ...seqSteps,
      {
        id: window.crypto?.randomUUID
          ? window.crypto.randomUUID()
          : 'step_' + Math.random().toString(36).substring(2, 9),
        type,
        config: defaultStepConfigs[type] || {}
      }
    ]);
  };

  const handleRemoveStep = (index: number) => {
    const updated = [...seqSteps];
    updated.splice(index, 1);
    setSeqSteps(updated);
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === seqSteps.length - 1) return;

    const updated = [...seqSteps];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setSeqSteps(updated);
  };

  const handleStepConfigChange = (index: number, key: string, val: any) => {
    const updated = [...seqSteps];
    updated[index].config = {
      ...updated[index].config,
      [key]: val
    };
    setSeqSteps(updated);
  };

  const handleManualTrigger = useCallback((seqId: string) => {
    const contactId = prompt('Enter Contact ID to enroll (optional):') || '';
    startSequenceMutation.mutate({ sequenceId: seqId, contactId, companyId: null });
  }, [startSequenceMutation]);

  const handleStopExecution = useCallback((execId: string) => {
    if (confirm('Are you sure you want to stop this execution?')) {
      stopSequenceMutation.mutate(execId);
    }
  }, [stopSequenceMutation]);

  // ── Render Helpers ───────────────────────────────────────────────────────

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'WAIT':
        return <Clock className="h-4 w-4 text-primary" />;
      case 'SEND_EMAIL':
        return <Mail className="h-4 w-4 text-primary" />;
      case 'ASSIGN_TAG':
      case 'REMOVE_TAG':
        return <Tag className="h-4 w-4 text-primary" />;
      case 'CREATE_NOTE':
        return <FileText className="h-4 w-4 text-primary" />;
      case 'ASSIGN_OWNER':
        return <UserCheck className="h-4 w-4 text-primary" />;
      case 'CONDITION':
        return <Layers className="h-4 w-4 text-primary" />;
      case 'FINISH_SEQUENCE':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'RUN_DISCOVERY':
        return <Search className="h-4 w-4 text-primary" />;
      case 'RUN_CRAWLER':
        return <Globe className="h-4 w-4 text-primary" />;
      case 'RUN_INTELLIGENCE':
      case 'GENERATE_AI_SUMMARY':
      case 'GENERATE_OPENING_LINE':
        return <Sparkles className="h-4 w-4 text-primary" />;
      case 'CREATE_CAMPAIGN':
      case 'ENROLL_CONTACT':
      case 'PAUSE_CAMPAIGN':
      case 'RESUME_CAMPAIGN':
        return <Mail className="h-4 w-4 text-primary" />;
      case 'SEND_NOTIFICATION':
        return <Bell className="h-4 w-4 text-primary" />;
      case 'EXPORT_CSV':
        return <Download className="h-4 w-4 text-primary" />;
      case 'BACKUP_WORKSPACE':
        return <FolderOpen className="h-4 w-4 text-primary" />;
      default:
        return <Zap className="h-4 w-4 text-primary" />;
    }
  };

  const getBadgeClass = (status: string) => {
    switch (status) {
      case 'ACTIVE':
      case 'COMPLETED':
      case 'SUCCESS':
        return 'bg-success-muted text-success border border-success/20 rounded-none';
      case 'PAUSED':
      case 'WAITING':
      case 'RUNNING':
        return 'bg-warning-muted text-warning border border-warning/20 rounded-none';
      case 'FAILED':
        return 'bg-danger-muted text-danger border border-danger/20 rounded-none';
      default:
        return 'bg-muted-muted text-muted-foreground border-border-subtle rounded-none';
    }
  };

  // ── Metrics Calculation ──────────────────────────────────────────────────

  const seqsList = sequencesQuery.data || [];
  const execsList = executionsQuery.data || [];

  const metrics = {
    totalSequences: seqsList.length,
    activeExecutions: execsList.filter((e: any) => e.status === 'RUNNING').length,
    waitingExecutions: execsList.filter((e: any) => e.status === 'WAITING').length,
    completedExecutions: execsList.filter((e: any) => e.status === 'COMPLETED').length,
    failedExecutions: execsList.filter((e: any) => e.status === 'FAILED').length
  };

  // Pagination calculation: Templates list
  const totalTemplates = seqsList.length;
  const totalTemplatesPages = Math.ceil(totalTemplates / templatesPerPage);
  const adjustedTemplatesPage = Math.min(Math.max(1, templatesPage), totalTemplatesPages || 1);
  const templatesStartIndex = (adjustedTemplatesPage - 1) * templatesPerPage;
  const paginatedTemplates = seqsList.slice(templatesStartIndex, templatesStartIndex + templatesPerPage);

  // Pagination calculation: Executions list
  const totalExecutions = execsList.length;
  const totalExecutionsPages = Math.ceil(totalExecutions / executionsPerPage);
  const adjustedExecutionsPage = Math.min(Math.max(1, executionsPage), totalExecutionsPages || 1);
  const executionsStartIndex = (adjustedExecutionsPage - 1) * executionsPerPage;
  const paginatedExecutions = execsList.slice(executionsStartIndex, executionsStartIndex + executionsPerPage);

  return (
    <div className="space-y-6 text-xs h-full overflow-y-auto pr-1 select-none">
      <PageHeader
        title="Sales Automation Sequences"
        description="Automate leads nurturing, emails dispatch, waits, and pipeline tasks updates."
        actions={
          <Button onClick={handleOpenNewEditor} size="sm" className="flex items-center gap-1 rounded-none">
            <Plus className="h-3.5 w-3.5" />
            <span>New Sequence</span>
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        {/* custom sliding active underline tab list */}
        <div className="border-b border-border-subtle flex gap-4 w-full relative mb-4">
          {[
            { id: 'dashboard', label: 'Dashboard', Icon: Zap },
            { id: 'sequences', label: 'Templates', Icon: Layers },
            { id: 'executions', label: 'Executions', Icon: Activity }
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
                    layoutId="automationActiveTabUnderline"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary"
                    transition={{ type: 'spring', stiffness: 550, damping: 38 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* ── TabsContent: Dashboard ─────────────────────────────────────────── */}
        <TabsContent value="dashboard" className="space-y-6 mt-0">
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-card border border-border-subtle p-4 rounded-none flex flex-col justify-between shadow-sm">
              <span className="text-muted-foreground font-semibold">Total Sequences</span>
              <span className="text-lg font-bold text-foreground mt-2 font-mono">
                {metrics.totalSequences}
              </span>
            </div>
            <div className="bg-card border border-border-subtle p-4 rounded-none flex flex-col justify-between shadow-sm">
              <span className="text-muted-foreground font-semibold">Active Runs</span>
              <span className="text-lg font-bold text-info mt-2 font-mono">
                {metrics.activeExecutions}
              </span>
            </div>
            <div className="bg-card border border-border-subtle p-4 rounded-none flex flex-col justify-between shadow-sm">
              <span className="text-muted-foreground font-semibold">Waiting Runs</span>
              <span className="text-lg font-bold text-warning mt-2 font-mono">
                {metrics.waitingExecutions}
              </span>
            </div>
            <div className="bg-card border border-border-subtle p-4 rounded-none flex flex-col justify-between shadow-sm">
              <span className="text-muted-foreground font-semibold">Completed Runs</span>
              <span className="text-lg font-bold text-success mt-2 font-mono">
                {metrics.completedExecutions}
              </span>
            </div>
            <div className="bg-card border border-border-subtle p-4 rounded-none flex flex-col justify-between shadow-sm">
              <span className="text-muted-foreground font-semibold">Failed Runs</span>
              <span className="text-lg font-bold text-danger mt-2 font-mono">
                {metrics.failedExecutions}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-card border border-border-subtle rounded-none p-5 space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                <Zap className="h-4 w-4 text-primary" />
                <span>Recent Sequences Templates</span>
              </h3>
              <div className="divide-y divide-border-subtle/50">
                {seqsList.slice(0, 5).map((seq: any, idx) => (
                  <div
                    key={idx}
                    className="py-2.5 flex justify-between items-center first:pt-0 last:pb-0"
                  >
                    <div>
                      <h4 className="font-medium text-foreground">{seq.name}</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">Trigger: {seq.trigger?.type}</p>
                    </div>
                    <Badge className={getBadgeClass(seq.status)}>
                      {seq.status}
                    </Badge>
                  </div>
                ))}
                {seqsList.length === 0 && (
                  <p className="text-muted-foreground text-[11px] py-4 text-center">
                    No sequences template created yet.
                  </p>
                )}
              </div>
            </div>

            <div className="bg-card border border-border-subtle rounded-none p-5 space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                <Activity className="h-4 w-4 text-primary" />
                <span>Latest Executions Activity</span>
              </h3>
              <div className="divide-y divide-border-subtle/50">
                {execsList.slice(0, 5).map((exec: any, idx) => (
                  <div
                    key={idx}
                    className="py-2.5 flex justify-between items-center first:pt-0 last:pb-0"
                  >
                    <div>
                      <h4 className="font-medium text-foreground">Execution {exec.id}</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                        Step Pointer: {exec.currentStep}
                      </p>
                    </div>
                    <Badge className={getBadgeClass(exec.status)}>
                      {exec.status}
                    </Badge>
                  </div>
                ))}
                {execsList.length === 0 && (
                  <p className="text-muted-foreground text-[11px] py-4 text-center">
                    No automation execution run activity found.
                  </p>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── TabsContent: Sequences List ───────────────────────────────────── */}
        <TabsContent value="sequences" className="space-y-4 mt-0">
          <div className="bg-card border border-border-subtle rounded-none divide-y divide-border-subtle/50">
            {paginatedTemplates.map((seq: any, idx) => (
              <div key={idx} className="p-4 flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold text-foreground">{seq.name}</h3>
                    <Badge className={getBadgeClass(seq.status)}>
                      {seq.status}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {seq.description || 'No description provided.'}
                  </p>
                  <div className="flex gap-4 text-[10px] text-muted-foreground pt-1">
                    <span>
                      Trigger Event: <strong className="text-foreground font-mono">{seq.trigger?.type}</strong>
                    </span>
                    <span>
                      Steps Count:{' '}
                      <strong className="text-foreground font-mono">
                        {typeof seq.steps === 'string'
                          ? JSON.parse(seq.steps).length
                          : seq.steps?.length || 0}
                      </strong>
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" className="rounded-none h-7 text-[10px]" onClick={() => handleManualTrigger(seq.id)}>
                    <Play className="h-3 w-3 mr-1" />
                    <span>Run</span>
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="rounded-none h-7 text-[10px]" onClick={() => handleOpenEditEditor(seq)}>
                    <span>Edit</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-none h-7 text-[10px] text-danger hover:bg-danger-muted border-danger/25"
                    onClick={() => {
                      if (confirm('Delete this template sequence?')) deleteSequenceMutation.mutate(seq.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            {seqsList.length === 0 && (
              <div className="p-12 text-center text-muted-foreground">
                <Layers className="h-10 w-10 mx-auto opacity-30 mb-2" />
                <p className="font-semibold text-xs">No Sequence Templates Found</p>
                <p className="text-[11px] opacity-75 mt-1">
                  Get started by creating your first automation template sequence card builder.
                </p>
              </div>
            )}
          </div>

          {/* Templates list pagination controls */}
          {totalTemplatesPages > 1 && (
            <div className="flex items-center justify-between border-t border-border-subtle pt-4 mt-2 select-none">
              <span className="text-[11px] text-muted-foreground">
                Showing{' '}
                <strong className="text-foreground font-mono">{templatesStartIndex + 1}</strong>{' '}
                to{' '}
                <strong className="text-foreground font-mono">
                  {Math.min(templatesStartIndex + templatesPerPage, totalTemplates)}
                </strong>{' '}
                of <strong className="text-foreground font-mono">{totalTemplates}</strong> templates
              </span>

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleTemplatesPageChange(Math.max(1, templatesPage - 1));
                  }}
                  disabled={adjustedTemplatesPage === 1}
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
                    handleTemplatesPageChange(Math.min(totalTemplatesPages, templatesPage + 1));
                  }}
                  disabled={adjustedTemplatesPage === totalTemplatesPages}
                  className="h-8 rounded-none px-3 text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── TabsContent: Executions Monitor ─────────────────────────────────── */}
        <TabsContent value="executions" className="space-y-4 mt-0">
          <div className="bg-card border border-border-subtle rounded-none overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-3/50 border-b border-border-subtle text-muted-foreground font-medium">
                  <th className="p-3">Execution ID</th>
                  <th className="p-3">Sequence</th>
                  <th className="p-3">Target Lead</th>
                  <th className="p-3">Step Pointer</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Next Execution</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50 text-foreground">
                {paginatedExecutions.map((exec: any, idx) => {
                  const seq = seqsList.find((s: any) => s.id === exec.sequenceId);
                  return (
                    <tr key={idx} className="hover:bg-surface-3/10">
                      <td className="p-3 font-mono text-[10px] text-muted-foreground">{exec.id}</td>
                      <td className="p-3 font-semibold">{seq?.name || 'Unknown Sequence'}</td>
                      <td className="p-3">
                        {exec.contactId ? (
                          <span className="text-primary font-mono font-semibold">Contact ({exec.contactId})</span>
                        ) : exec.companyId ? (
                          <span className="font-mono">Company ({exec.companyId})</span>
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </td>
                      <td className="p-3 font-medium">Step #{exec.currentStep}</td>
                      <td className="p-3">
                        <Badge className={getBadgeClass(exec.status)}>
                          {exec.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground font-mono">
                        {exec.nextExecutionAt
                          ? new Date(exec.nextExecutionAt).toLocaleTimeString()
                          : '—'}
                      </td>
                      <td className="p-3 text-right flex gap-1.5 justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-none h-7 text-[10px]"
                          onClick={() => {
                            setSelectedExecutionId(exec.id);
                            setLogsOpen(true);
                          }}
                        >
                          <History className="h-3 w-3 mr-1" />
                          <span>Logs</span>
                        </Button>
                        {['RUNNING', 'WAITING'].includes(exec.status) && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-none h-7 text-[10px] text-danger border-danger/20 hover:bg-danger-muted"
                            onClick={() => handleStopExecution(exec.id)}
                          >
                            <StopCircle className="h-3 w-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {execsList.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-muted-foreground">
                      <Activity className="h-10 w-10 mx-auto opacity-30 mb-2 animate-pulse" />
                      <p className="font-semibold text-xs">No Active Executions</p>
                      <p className="text-[11px] opacity-75 mt-1">
                        Enroll sequence templates from the list or trigger events in CRM.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Executions list pagination controls */}
          {totalExecutionsPages > 1 && (
            <div className="flex items-center justify-between border-t border-border-subtle pt-4 mt-2 select-none">
              <span className="text-[11px] text-muted-foreground">
                Showing{' '}
                <strong className="text-foreground font-mono">{executionsStartIndex + 1}</strong>{' '}
                to{' '}
                <strong className="text-foreground font-mono">
                  {Math.min(executionsStartIndex + executionsPerPage, totalExecutions)}
                </strong>{' '}
                of <strong className="text-foreground font-mono">{totalExecutions}</strong> runs
              </span>

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleExecutionsPageChange(Math.max(1, executionsPage - 1));
                  }}
                  disabled={adjustedExecutionsPage === 1}
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
                    handleExecutionsPageChange(Math.min(totalExecutionsPages, executionsPage + 1));
                  }}
                  disabled={adjustedExecutionsPage === totalExecutionsPages}
                  className="h-8 rounded-none px-3 text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Dialog Modal: Sequence Card Builder Editor ───────────────────── */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="min-w-xl text-xs max-h-[85vh] overflow-y-auto bg-background border border-border-subtle shadow-elevation-2 rounded-none">
          <DialogHeader>
            <DialogTitle>
              {editingSequenceId ? 'Edit Sequence' : 'Create Automation Sequence'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Sequence Name</Label>
                <Input
                  value={seqName}
                  onChange={(e) => setSeqName(e.target.value)}
                  placeholder="e.g. Lead Follow-up Outbound"
                  className="rounded-none bg-card border-border-subtle"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select
                  value={seqStatus}
                  onChange={(e) => setSeqStatus(e.target.value)}
                  className="w-full bg-card border border-border-subtle p-2 rounded-none text-xs focus-visible:outline-none"
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PAUSED">PAUSED</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={seqDesc}
                onChange={(e) => setSeqDesc(e.target.value)}
                placeholder="Sequence notes / automation details..."
                rows={2}
                className="rounded-none bg-card border-border-subtle"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Trigger Event</Label>
              <select
                value={seqTriggerType}
                onChange={(e) => setSeqTriggerType(e.target.value)}
                className="w-full bg-card border border-border-subtle p-2 rounded-none text-xs focus-visible:outline-none"
              >
                <option value="CONTACT_CREATED">Contact Created</option>
                <option value="COMPANY_CREATED">Company Created</option>
                <option value="DISCOVERY_FINISHED">Discovery Finished</option>
                <option value="CRAWLER_FINISHED">Crawler Finished</option>
                <option value="REPLY_RECEIVED">Reply Received</option>
                <option value="LEAD_SCORE_CHANGED">Lead Score Changed</option>
                <option value="IMPORT_FINISHED">Import Finished</option>
                <option value="UPDATE_INSTALLED">Update Installed</option>
                <option value="WORKSPACE_OPENED">Workspace Opened</option>
                <option value="SCHEDULE">Schedule Cron / Timer</option>
                <option value="MANUAL">Manual Trigger Only</option>
              </select>
            </div>

            <div className="border-t border-border-subtle pt-4 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-foreground">Sequence Action Cards</h3>
                <div className="flex gap-1.5">
                  <Button type="button" size="sm" variant="outline" className="rounded-none text-[10px]" onClick={() => handleAddStep('WAIT')}>
                    + Wait
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="rounded-none text-[10px]" onClick={() => handleAddStep('SEND_EMAIL')}>
                    + Email
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="rounded-none text-[10px]" onClick={() => handleAddStep('CONDITION')}>
                    + Condition
                  </Button>
                  <select
                    onChange={(e) => {
                      handleAddStep(e.target.value);
                      e.target.value = '';
                    }}
                    className="bg-card border border-border-subtle px-2 py-1 rounded-none text-[10px] focus-visible:outline-none font-semibold text-foreground"
                  >
                    <option value="">+ Other</option>
                    <option value="ASSIGN_TAG">Assign Tag</option>
                    <option value="REMOVE_TAG">Remove Tag</option>
                    <option value="CREATE_NOTE">Create Note</option>
                    <option value="MOVE_PIPELINE_STAGE">Move Pipeline Stage</option>
                    <option value="START_CAMPAIGN">Start Campaign</option>
                    <option value="STOP_CAMPAIGN">Stop Campaign</option>
                    <option value="ASSIGN_OWNER">Assign Owner</option>
                    <option value="CREATE_ACTIVITY">Create Activity</option>
                    <option value="RUN_DISCOVERY">Run Discovery</option>
                    <option value="RUN_CRAWLER">Run Website Crawl</option>
                    <option value="RUN_INTELLIGENCE">Run Lead Intelligence</option>
                    <option value="GENERATE_AI_SUMMARY">Generate AI Summary</option>
                    <option value="GENERATE_OPENING_LINE">Generate Opening Line</option>
                    <option value="CREATE_CAMPAIGN">Create Campaign</option>
                    <option value="ENROLL_CONTACT">Enroll Contact</option>
                    <option value="PAUSE_CAMPAIGN">Pause Campaign</option>
                    <option value="RESUME_CAMPAIGN">Resume Campaign</option>
                    <option value="SEND_NOTIFICATION">Send Notification</option>
                    <option value="EXPORT_CSV">Export CSV</option>
                    <option value="BACKUP_WORKSPACE">Backup Workspace</option>
                    <option value="FINISH_SEQUENCE">Finish Sequence</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3 bg-surface-3 p-4 border border-border-subtle rounded-none max-h-[300px] overflow-y-auto">
                <AnimatePresence initial={false}>
                  {seqSteps.map((step, idx) => (
                    <motion.div
                      key={step.id || idx}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="bg-card border border-border-subtle rounded-none p-3 flex justify-between items-center gap-4"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="shrink-0">{getStepIcon(step.type)}</div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">
                              Step #{idx + 1}: {step.type}
                            </span>
                          </div>

                          {/* STEP DETAIL CONFIG EDITORS */}
                          {step.type === 'WAIT' && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-muted-foreground">Delay (seconds):</span>
                              <Input
                                type="number"
                                value={step.config.delaySeconds || ''}
                                onChange={(e) =>
                                  handleStepConfigChange(
                                    idx,
                                    'delaySeconds',
                                    parseInt(e.target.value)
                                  )
                                }
                                className="h-7 w-20 px-1 py-0.5 text-xs text-center rounded-none bg-card border-border-subtle font-mono"
                              />
                            </div>
                          )}

                          {step.type === 'SEND_EMAIL' && (
                            <div className="flex items-center gap-2 mt-1 w-full">
                              <span className="text-[10px] text-muted-foreground shrink-0">Template:</span>
                              <select
                                value={step.config.templateId || ''}
                                onChange={(e) =>
                                  handleStepConfigChange(idx, 'templateId', e.target.value)
                                }
                                className="bg-card border border-border-subtle rounded-none px-1.5 py-0.5 text-[10px] max-w-[200px] focus-visible:outline-none"
                              >
                                <option value="">Select Template</option>
                                {templatesQuery.data?.map((t: any) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {step.type === 'CONDITION' && (
                            <div className="flex items-center gap-2 mt-1 w-full">
                              <span className="text-[10px] text-muted-foreground shrink-0">Condition:</span>
                              <select
                                value={step.config.conditionType || ''}
                                onChange={(e) =>
                                  handleStepConfigChange(idx, 'conditionType', e.target.value)
                                }
                                className="bg-card border border-border-subtle rounded-none px-1.5 py-0.5 text-[10px] focus-visible:outline-none"
                              >
                                <option value="NO_REPLY_RECEIVED">No Reply Received</option>
                                <option value="REPLY_RECEIVED">Reply Received</option>
                                <option value="EMAIL_BOUNCED">Email Bounced</option>
                                <option value="HAS_TAG">Has Tag</option>
                                <option value="PIPELINE_STAGE">Pipeline Stage</option>
                                <option value="COMPANY_INDUSTRY">Company Industry</option>
                              </select>
                            </div>
                          )}

                          {['ASSIGN_TAG', 'REMOVE_TAG'].includes(step.type) && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-muted-foreground">Tag Name:</span>
                              <Input
                                value={step.config.tag || ''}
                                onChange={(e) => handleStepConfigChange(idx, 'tag', e.target.value)}
                                className="h-7 w-32 px-2 py-0.5 text-xs rounded-none bg-card border-border-subtle"
                              />
                            </div>
                          )}

                          {step.type === 'CREATE_NOTE' && (
                            <div className="flex items-center gap-2 mt-1 w-full">
                              <span className="text-[10px] text-muted-foreground shrink-0">Content:</span>
                              <Input
                                value={step.config.content || ''}
                                onChange={(e) =>
                                  handleStepConfigChange(idx, 'content', e.target.value)
                                }
                                className="h-7 px-2 py-0.5 text-xs w-full rounded-none bg-card border-border-subtle"
                              />
                            </div>
                          )}

                          {step.type === 'MOVE_PIPELINE_STAGE' && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-muted-foreground">Stage:</span>
                              <select
                                value={step.config.stage || ''}
                                onChange={(e) => handleStepConfigChange(idx, 'stage', e.target.value)}
                                className="bg-card border border-border-subtle rounded-none px-1.5 py-0.5 text-[10px] focus-visible:outline-none"
                              >
                                <option value="NEW">New</option>
                                <option value="CONTACTED">Contacted</option>
                                <option value="REPLIED">Replied</option>
                                <option value="BOUNCED">Bounced</option>
                                <option value="LEAD">Lead</option>
                                <option value="CUSTOMER">Customer</option>
                              </select>
                            </div>
                          )}

                          {step.type === 'RUN_DISCOVERY' && (
                            <div className="space-y-1.5 mt-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground">Search Query:</span>
                                <Input
                                  value={step.config.query || ''}
                                  onChange={(e) =>
                                    handleStepConfigChange(idx, 'query', e.target.value)
                                  }
                                  className="h-7 px-2 py-0.5 text-xs w-48 rounded-none bg-card border-border-subtle font-mono"
                                  placeholder="e.g. dentists in Boston"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground font-medium">Limit:</span>
                                <Input
                                  type="number"
                                  value={step.config.limit || ''}
                                  onChange={(e) =>
                                    handleStepConfigChange(idx, 'limit', parseInt(e.target.value))
                                  }
                                  className="h-7 w-20 px-2 py-0.5 text-xs rounded-none bg-card border-border-subtle font-mono"
                                />
                              </div>
                            </div>
                          )}

                          {step.type === 'RUN_CRAWLER' && (
                            <div className="flex items-center gap-2 mt-1 w-full">
                              <span className="text-[10px] text-muted-foreground shrink-0">Website URL:</span>
                              <Input
                                value={step.config.website || ''}
                                onChange={(e) =>
                                  handleStepConfigChange(idx, 'website', e.target.value)
                                }
                                placeholder="e.g. {{company.domain}}"
                                className="h-7 px-2 py-0.5 text-xs w-full rounded-none bg-card border-border-subtle font-mono"
                              />
                            </div>
                          )}

                          {step.type === 'CREATE_CAMPAIGN' && (
                            <div className="space-y-1.5 mt-1 w-full">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground shrink-0 w-12">Name:</span>
                                <Input
                                  value={step.config.name || ''}
                                  onChange={(e) =>
                                    handleStepConfigChange(idx, 'name', e.target.value)
                                  }
                                  className="h-7 px-2 py-0.5 text-xs w-full rounded-none bg-card border-border-subtle"
                                  placeholder="Campaign Name"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground shrink-0 w-12">Subject:</span>
                                <Input
                                  value={step.config.subject || ''}
                                  onChange={(e) =>
                                    handleStepConfigChange(idx, 'subject', e.target.value)
                                  }
                                  className="h-7 px-2 py-0.5 text-xs w-full rounded-none bg-card border-border-subtle"
                                  placeholder="Subject template"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground shrink-0 w-12">Body:</span>
                                <Input
                                  value={step.config.body || ''}
                                  onChange={(e) =>
                                    handleStepConfigChange(idx, 'body', e.target.value)
                                  }
                                  className="h-7 px-2 py-0.5 text-xs w-full rounded-none bg-card border-border-subtle"
                                  placeholder="Body template content"
                                />
                              </div>
                            </div>
                          )}

                          {['ENROLL_CONTACT', 'PAUSE_CAMPAIGN', 'RESUME_CAMPAIGN'].includes(
                            step.type
                          ) && (
                            <div className="flex items-center gap-2 mt-1 w-full">
                              <span className="text-[10px] text-muted-foreground shrink-0">Campaign:</span>
                              <select
                                value={step.config.campaignId || ''}
                                onChange={(e) =>
                                  handleStepConfigChange(idx, 'campaignId', e.target.value)
                                }
                                className="bg-card border border-border-subtle rounded-none px-1.5 py-0.5 text-[10px] max-w-[200px] focus-visible:outline-none"
                              >
                                <option value="">Select Campaign</option>
                                {campaignsQuery.data?.map((c: any) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {step.type === 'SEND_NOTIFICATION' && (
                            <div className="space-y-1.5 mt-1 w-full">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground shrink-0 w-14">Message:</span>
                                <Input
                                  value={step.config.message || ''}
                                  onChange={(e) =>
                                    handleStepConfigChange(idx, 'message', e.target.value)
                                  }
                                  className="h-7 px-2 py-0.5 text-xs w-full rounded-none bg-card border-border-subtle"
                                  placeholder="Alert text"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground shrink-0 w-14">Type:</span>
                                <select
                                  value={step.config.type || 'info'}
                                  onChange={(e) =>
                                    handleStepConfigChange(idx, 'type', e.target.value)
                                  }
                                  className="bg-card border border-border-subtle rounded-none px-1.5 py-0.5 text-[10px] focus-visible:outline-none"
                                >
                                  <option value="info">Info</option>
                                  <option value="warning">Warning</option>
                                  <option value="success">Success</option>
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 rounded-none"
                          onClick={() => handleMoveStep(idx, 'up')}
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 rounded-none"
                          onClick={() => handleMoveStep(idx, 'down')}
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-danger hover:text-red-600 hover:bg-danger-muted rounded-none"
                          onClick={() => handleRemoveStep(idx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {seqSteps.length === 0 && (
                  <p className="text-center py-6 text-muted-foreground">
                    No step action cards added. Click buttons above to start compiling your sequence
                    flow.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
              <Button type="button" variant="secondary" className="rounded-none" onClick={() => setEditorOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="rounded-none"
                onClick={() => saveSequenceMutation.mutate()}
                disabled={saveSequenceMutation.isPending}
              >
                {saveSequenceMutation.isPending ? 'Saving...' : 'Save Sequence'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Modal: Sequence Execution Logs Timeline ───────────────── */}
      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent className="max-w-lg text-xs bg-background border border-border-subtle shadow-elevation-2 rounded-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <History className="h-4 w-4 text-primary animate-spin" style={{ animationDuration: '3s' }} />
              <span>Execution History Logs Timeline</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="relative border-l border-border-subtle pl-4 ml-2 space-y-4">
              {logsQuery.data?.map((log: any, idx: number) => (
                <div key={idx} className="relative space-y-1">
                  {/* Squared timeline bullet indicator */}
                  <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-none border border-card bg-primary shrink-0" />
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-foreground">
                      Step #{log.step}: {log.action}
                    </span>
                    <span className="text-[9px] text-muted-foreground font-mono">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-[10px]">{log.message}</p>
                  <Badge className={getBadgeClass(log.status)}>
                    {log.status}
                  </Badge>
                </div>
              ))}
              {logsQuery.data?.length === 0 && (
                <p className="text-muted-foreground text-center py-6">No execution logs found.</p>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-border-subtle">
            <Button type="button" className="rounded-none" onClick={() => setLogsOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
