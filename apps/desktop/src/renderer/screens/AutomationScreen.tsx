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
  Settings,
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
  Info,
  Copy,
  Layers
} from 'lucide-react';
import { toast } from 'sonner';

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
    enabled: !!selectedExecutionId,
  });

  const templatesQuery = useQuery({
    queryKey: ['email_templates', workspaceId],
    queryFn: async () => {
      return window.ipc.invoke('templates:list', undefined);
    },
    enabled: !!workspaceId,
  });

  const contactsQuery = useQuery({
    queryKey: ['contacts', workspaceId],
    queryFn: async () => {
      const res = await window.ipc.invoke('contacts:list', {});
      return res;
    },
    enabled: !!workspaceId,
  });

  const campaignsQuery = useQuery({
    queryKey: ['campaigns', workspaceId],
    queryFn: async () => {
      return window.ipc.invoke('campaigns:list', undefined);
    },
    enabled: !!workspaceId,
  });

  // ── Mutations ────────────────────────────────────────────────────────────

  const saveSequenceMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: seqName,
        description: seqDesc,
        status: seqStatus,
        trigger: { type: seqTriggerType, config: {} },
        steps: seqSteps,
      };

      if (editingSequenceId) {
        return window.ipc.invoke('sequence:update', { id: editingSequenceId, dto: payload });
      } else {
        return window.ipc.invoke('sequence:create', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequences', 'list', workspaceId] });
      toast.success(editingSequenceId ? 'Sequence updated successfully.' : 'Sequence created successfully.');
      setEditorOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save sequence.');
    },
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
    },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleOpenNewEditor = () => {
    setEditingSequenceId(null);
    setSeqName('');
    setSeqDesc('');
    setSeqTriggerType('CONTACT_CREATED');
    setSeqStatus('DRAFT');
    setSeqSteps([]);
    setEditorOpen(true);
  };

  const handleOpenEditEditor = (seq: any) => {
    setEditingSequenceId(seq.id || seq._id);
    setSeqName(seq.name);
    setSeqDesc(seq.description || '');
    setSeqTriggerType(seq.trigger?.type || 'CONTACT_CREATED');
    setSeqStatus(seq.status);
    
    // Parse steps from string if cached locally as JSON string
    const parsedSteps = typeof seq.steps === 'string' ? JSON.parse(seq.steps) : seq.steps;
    setSeqSteps(parsedSteps || []);
    setEditorOpen(true);
  };

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
    };

    setSeqSteps([
      ...seqSteps,
      {
        id: crypto.randomUUID(),
        type,
        config: defaultStepConfigs[type] || {},
      },
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
      [key]: val,
    };
    setSeqSteps(updated);
  };

  const handleManualTrigger = (seqId: string) => {
    const contactId = prompt('Enter Contact ID to enroll (optional):') || '';
    startSequenceMutation.mutate({ sequenceId: seqId, contactId, companyId: null });
  };

  const handleStopExecution = (execId: string) => {
    if (confirm('Are you sure you want to stop this execution?')) {
      stopSequenceMutation.mutate(execId);
    }
  };

  // ── Render Helpers ───────────────────────────────────────────────────────

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'WAIT': return <Clock className="h-4.5 w-4.5 text-blue-500" />;
      case 'SEND_EMAIL': return <Mail className="h-4.5 w-4.5 text-purple-500" />;
      case 'ASSIGN_TAG':
      case 'REMOVE_TAG': return <Tag className="h-4.5 w-4.5 text-teal-500" />;
      case 'CREATE_NOTE': return <FileText className="h-4.5 w-4.5 text-amber-500" />;
      case 'ASSIGN_OWNER': return <UserCheck className="h-4.5 w-4.5 text-indigo-500" />;
      case 'CONDITION': return <Layers className="h-4.5 w-4.5 text-cyan-500" />;
      case 'FINISH_SEQUENCE': return <CheckCircle className="h-4.5 w-4.5 text-emerald-500" />;
      default: return <Zap className="h-4.5 w-4.5 text-muted" />;
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
    failedExecutions: execsList.filter((e: any) => e.status === 'FAILED').length,
  };

  return (
    <div className="space-y-6 text-xs animate-in fade-in duration-200">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Sales Automation Sequences</h2>
          <p className="text-[11px] text-secondary mt-0.5">Automate leads nurturing, emails dispatch, waits, and pipeline tasks updates.</p>
        </div>
        <Button onClick={handleOpenNewEditor} size="sm" className="flex items-center gap-1">
          <Plus className="h-3.5 w-3.5" />
          <span>New Sequence</span>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard" className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            <span>Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="sequences" className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            <span>Templates</span>
          </TabsTrigger>
          <TabsTrigger value="executions" className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            <span>Executions</span>
          </TabsTrigger>
        </TabsList>

        {/* ── TabsContent: Dashboard ─────────────────────────────────────────── */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-card border border-border-subtle p-4 rounded-xl flex flex-col justify-between shadow-sm">
              <span className="text-secondary font-medium">Total Sequences</span>
              <span className="text-lg font-bold text-foreground mt-2">{metrics.totalSequences}</span>
            </div>
            <div className="bg-card border border-border-subtle p-4 rounded-xl flex flex-col justify-between shadow-sm">
              <span className="text-secondary font-medium">Active Runs</span>
              <span className="text-lg font-bold text-blue-500 mt-2">{metrics.activeExecutions}</span>
            </div>
            <div className="bg-card border border-border-subtle p-4 rounded-xl flex flex-col justify-between shadow-sm">
              <span className="text-secondary font-medium">Waiting Runs</span>
              <span className="text-lg font-bold text-amber-500 mt-2">{metrics.waitingExecutions}</span>
            </div>
            <div className="bg-card border border-border-subtle p-4 rounded-xl flex flex-col justify-between shadow-sm">
              <span className="text-secondary font-medium">Completed Runs</span>
              <span className="text-lg font-bold text-emerald-500 mt-2">{metrics.completedExecutions}</span>
            </div>
            <div className="bg-card border border-border-subtle p-4 rounded-xl flex flex-col justify-between shadow-sm">
              <span className="text-secondary font-medium">Failed Runs</span>
              <span className="text-lg font-bold text-rose-500 mt-2">{metrics.failedExecutions}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-card border border-border-subtle rounded-xl p-5 space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                <Zap className="h-4 w-4 text-accent" />
                <span>Recent Sequences Templates</span>
              </h3>
              <div className="divide-y divide-border-subtle/50">
                {seqsList.slice(0, 5).map((seq: any, idx) => (
                  <div key={idx} className="py-2.5 flex justify-between items-center first:pt-0 last:pb-0">
                    <div>
                      <h4 className="font-medium text-foreground">{seq.name}</h4>
                      <p className="text-[10px] text-muted mt-0.5">Trigger: {seq.trigger?.type}</p>
                    </div>
                    <Badge variant="secondary" className={seq.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : ''}>{seq.status}</Badge>
                  </div>
                ))}
                {seqsList.length === 0 && (
                  <p className="text-muted text-[11px] py-4 text-center">No sequences template created yet.</p>
                )}
              </div>
            </div>

            <div className="bg-card border border-border-subtle rounded-xl p-5 space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                <Activity className="h-4 w-4 text-accent" />
                <span>Latest Executions Activity</span>
              </h3>
              <div className="divide-y divide-border-subtle/50">
                {execsList.slice(0, 5).map((exec: any, idx) => (
                  <div key={idx} className="py-2.5 flex justify-between items-center first:pt-0 last:pb-0">
                    <div>
                      <h4 className="font-medium text-foreground">Execution {exec.id || exec._id}</h4>
                      <p className="text-[10px] text-muted mt-0.5">Step Pointer: {exec.currentStep}</p>
                    </div>
                    <Badge variant={exec.status === 'FAILED' ? 'destructive' : 'secondary'} className={exec.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : exec.status === 'WAITING' || exec.status === 'RUNNING' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' : ''}>
                      {exec.status}
                    </Badge>
                  </div>
                ))}
                {execsList.length === 0 && (
                  <p className="text-muted text-[11px] py-4 text-center">No automation execution run activity found.</p>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── TabsContent: Sequences List ───────────────────────────────────── */}
        <TabsContent value="sequences" className="space-y-4">
          <div className="bg-card border border-border-subtle rounded-xl divide-y divide-border-subtle/50">
            {seqsList.map((seq: any, idx) => (
              <div key={idx} className="p-4 flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold text-foreground">{seq.name}</h3>
                    <Badge variant="secondary" className={seq.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : seq.status === 'PAUSED' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' : ''}>
                      {seq.status}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-secondary">{seq.description || 'No description provided.'}</p>
                  <div className="flex gap-4 text-[10px] text-muted pt-1">
                    <span>Trigger Event: <strong>{seq.trigger?.type}</strong></span>
                    <span>Steps Count: <strong>{typeof seq.steps === 'string' ? JSON.parse(seq.steps).length : seq.steps?.length || 0}</strong></span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleManualTrigger(seq.id || seq._id)}>
                    <Play className="h-3 w-3 mr-1" />
                    <span>Run</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleOpenEditEditor(seq)}>
                    <span>Edit</span>
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => { if(confirm('Delete?')) deleteSequenceMutation.mutate(seq.id || seq._id); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            {seqsList.length === 0 && (
              <div className="p-12 text-center text-muted-foreground">
                <Layers className="h-10 w-10 mx-auto opacity-30 mb-2" />
                <p className="font-semibold text-xs">No Sequence Templates Found</p>
                <p className="text-[11px] opacity-75 mt-1">Get started by creating your first automation template sequence card builder.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── TabsContent: Executions Monitor ─────────────────────────────────── */}
        <TabsContent value="executions" className="space-y-4">
          <div className="bg-card border border-border-subtle rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-sunken/40 border-b border-border-subtle text-secondary font-medium">
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
                {execsList.map((exec: any, idx) => {
                  const seq = seqsList.find((s: any) => (s.id || s._id) === exec.sequenceId);
                  return (
                    <tr key={idx} className="hover:bg-sunken/10">
                      <td className="p-3 font-mono text-[10px] text-muted">{exec.id || exec._id}</td>
                      <td className="p-3 font-semibold">{seq?.name || 'Unknown Sequence'}</td>
                      <td className="p-3">
                        {exec.contactId ? (
                          <span className="text-accent">Contact ({exec.contactId})</span>
                        ) : exec.companyId ? (
                          <span>Company ({exec.companyId})</span>
                        ) : (
                          <span className="text-muted">None</span>
                        )}
                      </td>
                      <td className="p-3 font-medium">Step #{exec.currentStep}</td>
                      <td className="p-3">
                        <Badge variant={exec.status === 'FAILED' ? 'destructive' : 'secondary'} className={exec.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : exec.status === 'WAITING' || exec.status === 'RUNNING' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' : ''}>
                          {exec.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted">
                        {exec.nextExecutionAt ? new Date(exec.nextExecutionAt).toLocaleTimeString() : 'N/A'}
                      </td>
                      <td className="p-3 text-right flex gap-1.5 justify-end">
                        <Button variant="outline" size="sm" onClick={() => { setSelectedExecutionId(exec.id || exec._id); setLogsOpen(true); }}>
                          <History className="h-3 w-3 mr-1" />
                          <span>Logs</span>
                        </Button>
                        {['RUNNING', 'WAITING'].includes(exec.status) && (
                          <Button variant="destructive" size="sm" onClick={() => handleStopExecution(exec.id || exec._id)}>
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
                      <Activity className="h-10 w-10 mx-auto opacity-30 mb-2" />
                      <p className="font-semibold text-xs">No Active Executions</p>
                      <p className="text-[11px] opacity-75 mt-1">Enroll sequence templates from the list or trigger events in CRM.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Dialog Modal: Sequence Card Builder Editor ───────────────────── */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl text-xs max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSequenceId ? 'Edit Sequence' : 'Create Automation Sequence'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Sequence Name</Label>
                <Input value={seqName} onChange={(e) => setSeqName(e.target.value)} placeholder="e.g. Lead Follow-up Outbound" />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select value={seqStatus} onChange={(e) => setSeqStatus(e.target.value)} className="w-full bg-sunken border border-border-subtle p-2 rounded text-xs">
                  <option value="DRAFT">DRAFT</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PAUSED">PAUSED</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={seqDesc} onChange={(e) => setSeqDesc(e.target.value)} placeholder="Sequence notes / automation details..." rows={2} />
            </div>

            <div className="space-y-1.5">
              <Label>Trigger Event</Label>
              <select value={seqTriggerType} onChange={(e) => setSeqTriggerType(e.target.value)} className="w-full bg-sunken border border-border-subtle p-2 rounded text-xs">
                <option value="CONTACT_CREATED">Contact Created</option>
                <option value="COMPANY_CREATED">Company Created</option>
                <option value="DISCOVERY_IMPORT_COMPLETED">Discovery Import Completed</option>
                <option value="CAMPAIGN_COMPLETED">Campaign Completed</option>
                <option value="EMAIL_SENT">Email Sent</option>
                <option value="EMAIL_REPLIED">Email Replied</option>
                <option value="EMAIL_BOUNCED">Email Bounced</option>
                <option value="TAG_ADDED">Tag Added</option>
                <option value="PIPELINE_STAGE_CHANGED">Pipeline Stage Changed</option>
                <option value="MANUAL">Manual Trigger Only</option>
              </select>
            </div>

            <div className="border-t border-border-subtle pt-4 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-foreground">Sequence Action Cards</h3>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => handleAddStep('WAIT')}>+ Wait</Button>
                  <Button size="sm" variant="outline" onClick={() => handleAddStep('SEND_EMAIL')}>+ Email</Button>
                  <Button size="sm" variant="outline" onClick={() => handleAddStep('CONDITION')}>+ Condition</Button>
                  <select onChange={(e) => { handleAddStep(e.target.value); e.target.value = ''; }} className="bg-sunken border border-border-subtle px-2 py-1 rounded text-[10px]">
                    <option value="">+ Other</option>
                    <option value="ASSIGN_TAG">Assign Tag</option>
                    <option value="REMOVE_TAG">Remove Tag</option>
                    <option value="CREATE_NOTE">Create Note</option>
                    <option value="MOVE_PIPELINE_STAGE">Move Pipeline Stage</option>
                    <option value="START_CAMPAIGN">Start Campaign</option>
                    <option value="STOP_CAMPAIGN">Stop Campaign</option>
                    <option value="ASSIGN_OWNER">Assign Owner</option>
                    <option value="CREATE_ACTIVITY">Create Activity</option>
                    <option value="FINISH_SEQUENCE">Finish Sequence</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3 bg-sunken/20 p-4 border border-border-subtle rounded-xl max-h-[300px] overflow-y-auto">
                {seqSteps.map((step, idx) => (
                  <div key={step.id || idx} className="bg-card border border-border-subtle rounded-lg p-3 flex justify-between items-center gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="shrink-0">{getStepIcon(step.type)}</div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">Step #{idx + 1}: {step.type}</span>
                        </div>

                        {/* STEP DETAIL CONFIG EDITORS */}
                        {step.type === 'WAIT' && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-muted">Delay (seconds):</span>
                            <Input
                              type="number"
                              value={step.config.delaySeconds || ''}
                              onChange={(e) => handleStepConfigChange(idx, 'delaySeconds', parseInt(e.target.value))}
                              className="h-7 w-20 px-1 py-0.5 text-xs text-center"
                            />
                          </div>
                        )}

                        {step.type === 'SEND_EMAIL' && (
                          <div className="flex items-center gap-2 mt-1 w-full">
                            <span className="text-[10px] text-muted shrink-0">Template:</span>
                            <select
                              value={step.config.templateId || ''}
                              onChange={(e) => handleStepConfigChange(idx, 'templateId', e.target.value)}
                              className="bg-sunken border border-border-subtle rounded px-1.5 py-0.5 text-[10px] max-w-[200px]"
                            >
                              <option value="">Select Template</option>
                              {templatesQuery.data?.map((t: any) => (
                                <option key={t.id || t._id} value={t.id || t._id}>{t.name}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {step.type === 'CONDITION' && (
                          <div className="flex items-center gap-2 mt-1 w-full">
                            <span className="text-[10px] text-muted shrink-0">Condition:</span>
                            <select
                              value={step.config.conditionType || ''}
                              onChange={(e) => handleStepConfigChange(idx, 'conditionType', e.target.value)}
                              className="bg-sunken border border-border-subtle rounded px-1.5 py-0.5 text-[10px]"
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
                            <span className="text-[10px] text-muted">Tag Name:</span>
                            <Input
                              value={step.config.tag || ''}
                              onChange={(e) => handleStepConfigChange(idx, 'tag', e.target.value)}
                              className="h-7 w-32 px-2 py-0.5 text-xs"
                            />
                          </div>
                        )}

                        {step.type === 'CREATE_NOTE' && (
                          <div className="flex items-center gap-2 mt-1 w-full">
                            <span className="text-[10px] text-muted shrink-0">Content:</span>
                            <Input
                              value={step.config.content || ''}
                              onChange={(e) => handleStepConfigChange(idx, 'content', e.target.value)}
                              className="h-7 px-2 py-0.5 text-xs w-full"
                            />
                          </div>
                        )}

                        {step.type === 'MOVE_PIPELINE_STAGE' && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-muted">Stage:</span>
                            <select
                              value={step.config.stage || ''}
                              onChange={(e) => handleStepConfigChange(idx, 'stage', e.target.value)}
                              className="bg-sunken border border-border-subtle rounded px-1.5 py-0.5 text-[10px]"
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
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleMoveStep(idx, 'up')}>
                        <ChevronUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleMoveStep(idx, 'down')}>
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10" onClick={() => handleRemoveStep(idx)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {seqSteps.length === 0 && (
                  <p className="text-center py-6 text-muted">No step action cards added. Click buttons above to start compiling your sequence flow.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
              <Button onClick={() => saveSequenceMutation.mutate()} disabled={saveSequenceMutation.isPending}>
                {saveSequenceMutation.isPending ? 'Saving...' : 'Save Sequence'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Modal: Sequence Execution Logs Timeline ───────────────── */}
      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent className="max-w-lg text-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <History className="h-4 w-4 text-accent" />
              <span>Execution History Logs Timeline</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="relative border-l border-border-subtle pl-4 ml-2 space-y-4">
              {logsQuery.data?.map((log: any, idx: number) => (
                <div key={idx} className="relative space-y-1">
                  <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border border-card bg-accent shrink-0" />
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-foreground">Step #{log.step}: {log.action}</span>
                    <span className="text-[9px] text-muted">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-secondary text-[10px]">{log.message}</p>
                  <Badge variant={log.status === 'SUCCESS' || log.status === 'RUNNING' ? 'secondary' : 'destructive'} className={"text-[8px] px-1 py-0 scale-90 origin-left " + (log.status === 'SUCCESS' || log.status === 'RUNNING' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : '')}>
                    {log.status}
                  </Badge>
                </div>
              ))}
              {logsQuery.data?.length === 0 && (
                <p className="text-muted text-center py-6">No execution logs found.</p>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setLogsOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
