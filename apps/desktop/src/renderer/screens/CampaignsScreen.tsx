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
  Megaphone,
  Plus,
  Mail,
  FileText,
  Play,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Eye,
  CheckCircle,
  Settings,
  HelpCircle
} from 'lucide-react';

export default function CampaignsScreen() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || '';
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('campaigns');

  // Modal Dialog states
  const [accountOpen, setAccountOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

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

  const [campName, setCampName] = useState('');
  const [campAccId, setCampAccId] = useState('');
  const [campTplId, setCampTplId] = useState('');

  const [previewTemplateId, setPreviewTemplateId] = useState('');
  const [previewContactId, setPreviewContactId] = useState('');

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
      // Reset form
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

  const createCampaignMutation = useMutation({
    mutationFn: async (payload: any) => {
      return window.ipc.invoke('campaigns:create', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] });
      setCampaignOpen(false);
      setCampName('');
    },
  });

  const runCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      return window.ipc.invoke('campaigns:schedule', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] });
      alert('Campaign run sequence initiated! Sending starting in background...');
    },
  });

  // handlers
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
    if (!campAccId || !campTplId) {
      alert('Please connect/select an Email Account and Template first.');
      return;
    }
    createCampaignMutation.mutate({
      name: campName,
      steps: [
        {
          id: 'step_1',
          type: 'email',
          delayDays: 0,
          templateId: campTplId,
        },
      ],
    });
  };

  const accounts = accountsQuery.data || [];
  const templates = templatesQuery.data || [];
  const campaigns = campaignsQuery.data || [];
  const contacts = contactsQuery.data || [];

  return (
    <div className="space-y-6 text-xs font-sans h-full overflow-y-auto pr-1">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Outreach Platform</h2>
          <p className="text-[11px] text-secondary mt-0.5">
            Manage credentials, templates, and outbound email sequences.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-sunken p-0.5 border border-border-subtle rounded flex w-max gap-1">
          <TabsTrigger value="campaigns" className="px-3 py-1.5 flex items-center gap-1.5">
            <Megaphone className="h-3 w-3" />
            <span>Campaigns</span>
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

        {/* ── Campaigns Tab ────────────────────────────────────────────────── */}
        <TabsContent value="campaigns" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-foreground text-[11px]">Outbound Sequences</span>
            <Button onClick={() => setCampaignOpen(true)} size="sm" className="flex items-center gap-1">
              <Plus className="h-3 w-3" />
              Launch Campaign
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campaigns.map((camp) => (
              <div key={camp.id} className="bg-card border border-border-subtle rounded p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-foreground">{camp.name}</h4>
                    <Badge variant={camp.status === 'ACTIVE' ? 'default' : 'secondary'} className="mt-1">
                      {camp.status}
                    </Badge>
                  </div>
                  {camp.status !== 'ACTIVE' && camp.status !== 'COMPLETED' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runCampaignMutation.mutate(camp.id)}
                      disabled={runCampaignMutation.isPending}
                      className="flex items-center gap-1"
                    >
                      <Play className="h-3 w-3 text-emerald-500" />
                      Run Campaign
                    </Button>
                  )}
                </div>

                <div className="text-[10px] text-muted space-y-1">
                  <div>Recipients: Contacts in active workspace</div>
                </div>
              </div>
            ))}

            {campaigns.length === 0 && (
              <div className="col-span-2 text-center py-8 border border-dashed border-border-subtle rounded text-muted">
                No active campaigns created yet.
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Templates Tab ────────────────────────────────────────────────── */}
        <TabsContent value="templates" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-foreground text-[11px]">Email Templates</span>
            <Button onClick={() => setTemplateOpen(true)} size="sm" className="flex items-center gap-1">
              <Plus className="h-3 w-3" />
              Create Template
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((tpl) => (
              <div key={tpl.id} className="bg-card border border-border-subtle rounded p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-foreground">{tpl.name}</h4>
                    <p className="text-[10px] text-muted mt-0.5">Subject: {tpl.subject}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setPreviewTemplateId(tpl.id);
                        setPreviewOpen(true);
                      }}
                      className="h-7 w-7 p-0"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteTemplateMutation.mutate(tpl.id)}
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {tpl.variables?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {tpl.variables.map((v: string) => (
                      <span key={v} className="bg-sunken text-muted px-1.5 py-0.5 rounded text-[9px] font-mono border border-border-subtle">
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {templates.length === 0 && (
              <div className="col-span-2 text-center py-8 border border-dashed border-border-subtle rounded text-muted">
                No templates configured.
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Email Accounts Tab ───────────────────────────────────────────── */}
        <TabsContent value="accounts" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-foreground text-[11px]">Connected Senders</span>
            <Button onClick={() => setAccountOpen(true)} size="sm" className="flex items-center gap-1">
              <Plus className="h-3 w-3" />
              Connect Gmail
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.map((acc) => (
              <div key={acc.id} className="bg-card border border-border-subtle rounded p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-foreground">{acc.name}</h4>
                    <p className="text-[10px] text-muted mt-0.5">{acc.email}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => verifyAccountMutation.mutate(acc.id)}
                      disabled={verifyAccountMutation.isPending}
                      className="h-7 w-7 p-0"
                      title="Test Connection"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
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

                <div className="flex justify-between items-center text-[10px] pt-1 border-t border-border-subtle/50">
                  <div className="flex items-center gap-1">
                    <span className={`h-1.5 w-1.5 rounded-full ${acc.status === 'connected' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <span className="capitalize">{acc.status}</span>
                  </div>
                  <span className="font-mono text-muted">{`Limits: ${acc.dailySent}/${acc.dailyLimit} daily`}</span>
                </div>
              </div>
            ))}

            {accounts.length === 0 && (
              <div className="col-span-2 text-center py-8 border border-dashed border-border-subtle rounded text-muted">
                No connected Gmail accounts found. Click 'Connect Gmail' to setup your App Password.
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
              <Label htmlFor="campAcc">Sender Email Account</Label>
              <select
                id="campAcc"
                value={campAccId}
                onChange={(e) => setCampAccId(e.target.value)}
                className="w-full h-8 px-2 bg-background border border-input rounded text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                required
              >
                <option value="">-- Select Sender Account --</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {`${acc.name} (${acc.email})`}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="campTpl">Email Template</Label>
              <select
                id="campTpl"
                value={campTplId}
                onChange={(e) => setCampTplId(e.target.value)}
                className="w-full h-8 px-2 bg-background border border-input rounded text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                required
              >
                <option value="">-- Select Template --</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </select>
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
              <div className="text-center py-4 text-muted">Compiling template...</div>
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
