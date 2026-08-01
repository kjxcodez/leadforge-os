import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../hooks/useWorkspace';
import {
  useWorkspaceMembers,
  useUpdateMemberRole,
  useRemoveMember
} from '../hooks/useWorkspaceQuery';
import { usePermissions } from '../hooks/usePermissions';
import { UserAvatar } from '../components/ui/UserAvatar';
import { Button } from '../components/ui/button';
import { RenameWorkspaceDialog, DeleteWorkspaceDialog } from '../components/ui/WorkspaceDialogs';
import {
  InviteMemberDialog,
  LeaveWorkspaceDialog,
  TransferOwnershipDialog
} from '../components/ui/MemberDialogs';
import { WorkspaceRole, WorkspaceMemberStatus, type WorkspaceMember } from '@leadforge/schema';
import {
  ShieldAlert,
  Trash2,
  UserPlus,
  LogOut,
  ArrowLeftRight,
  Key,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Linkedin,
  Sparkles
} from 'lucide-react';

/**
 * WorkspaceSettingsScreen enables team management, invitation oversight,
 * role adjustments, ownership transfer, and workspace settings updates.
 */
export default function WorkspaceSettingsScreen() {
  const { activeWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const { role, isOwner, isAdmin } = usePermissions();

  const membersQuery = useWorkspaceMembers(activeWorkspace?.id || '');
  const updateRoleMutation = useUpdateMemberRole(activeWorkspace?.id || '');
  const removeMemberMutation = useRemoveMember(activeWorkspace?.id || '');

  // Dialog states
  const [inviteOpen, setInviteOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  // Ownership Transfer state
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<{ id: string; name: string } | null>(null);

  if (!activeWorkspace) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-muted-foreground text-xs">
        No active workspace selected.
      </div>
    );
  }

  const handleRoleChange = async (memberId: string, newRole: string) => {
    await updateRoleMutation.mutateAsync({ memberId, role: newRole as WorkspaceRole });
  };

  const handleRemove = async (memberId: string) => {
    if (confirm('Are you sure you want to remove this member from the workspace?')) {
      await removeMemberMutation.mutateAsync(memberId);
    }
  };

  const startTransfer = (memberId: string, name: string) => {
    setTransferTarget({ id: memberId, name });
    setTransferOpen(true);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6 font-sans">
      {/* Header */}
      <div className="border-b border-border-subtle pb-5">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Workspace Settings</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Manage your workspace details, invites, and team permissions.
        </p>
      </div>

      {/* ── SECTION 1: General Details ──────────────────────────────────── */}
      <div className="bg-card border border-border-subtle rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">General</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Basic details for this workspace.
            </p>
          </div>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setRenameOpen(true)}>
              Rename
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              Workspace Name
            </span>
            <p className="text-xs font-medium text-foreground">{activeWorkspace.name}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              Unique URL Slug
            </span>
            <p className="text-xs font-mono text-muted-foreground">/{activeWorkspace.slug}</p>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Members Management ──────────────────────────────── */}
      <div className="bg-card border border-border-subtle rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Workspace Members</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Collaborators in this workspace.</p>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => setInviteOpen(true)} className="gap-1">
              <UserPlus className="w-3.5 h-3.5" />
              <span>Invite Member</span>
            </Button>
          )}
        </div>

        {/* Member list */}
        {membersQuery.isLoading ? (
          <div className="py-4 text-center text-xs text-muted-foreground">Loading members...</div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {((membersQuery.data as WorkspaceMember[]) || []).map((m) => {
              const emailStr = m.email || '';
              const memberName = emailStr.split('@')[0] || 'User';
              const isSelf = m.userId === activeWorkspace.ownerId; // placeholder check

              return (
                <div
                  key={m.id || m.userId || m.email}
                  className="flex items-center justify-between py-3"
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar initials={memberName.substring(0, 2).toUpperCase()} size="sm" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-foreground">{m.email}</span>
                        {m.status === WorkspaceMemberStatus.PENDING && (
                          <span className="px-1.5 py-0.5 rounded bg-warning-bg text-warning-text text-[9px] font-bold">
                            Pending
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        Joined {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Role selector */}
                    {isAdmin && m.role !== WorkspaceRole.OWNER ? (
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.userId || m.id || '', e.target.value)}
                        className="bg-sunken border border-border rounded px-2 py-1 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value={WorkspaceRole.MEMBER}>Member</option>
                        <option value={WorkspaceRole.ADMIN}>Admin</option>
                        <option value={WorkspaceRole.READ_ONLY}>Read Only</option>
                        <option value={WorkspaceRole.BILLING}>Billing</option>
                      </select>
                    ) : (
                      <span className="text-[10px] font-bold text-muted-foreground px-2 py-0.5 border border-border rounded bg-sunken">
                        {m.role}
                      </span>
                    )}

                    {/* Ownership transfer */}
                    {isOwner &&
                      m.role !== WorkspaceRole.OWNER &&
                      m.status === WorkspaceMemberStatus.ACTIVE && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Transfer Ownership"
                          onClick={() => startTransfer(m.userId || '', m.email)}
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                        </Button>
                      )}

                    {/* Remove member button */}
                    {isAdmin && m.role !== WorkspaceRole.OWNER && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRemove(m.userId || m.id || '')}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-danger-text" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── SECTION 3: LinkedIn Integration ─────────────────────────────── */}
      <LinkedInIntegrationCard workspaceId={activeWorkspace.id || ''} />

      {/* ── SECTION 3.5: Auto Updates ───────────────────────────────────── */}
      <AutoUpdateSection />

      {/* ── SECTION 3.6: Onboarding & Interactive Guides ──────────────── */}
      <div className="bg-card border border-border-subtle rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-accent" />
            <span>Interactive Guides & Onboarding</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Replay app tours or reset workspace initialization configuration.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div className="flex items-center justify-between border border-border rounded-lg p-3 bg-sunken/15">
            <div>
              <p className="text-xs font-semibold text-foreground">Interactive Product Tour</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Highlights discovery, CRM, and campaigns navigation.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                localStorage.setItem('product_tour_active', 'true');
                navigate('/');
              }}
            >
              Start Tour
            </Button>
          </div>

          <div className="flex items-center justify-between border border-border rounded-lg p-3 bg-sunken/15">
            <div>
              <p className="text-xs font-semibold text-foreground">Workspace Setup Wizard</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Rerun the health check diagnostics and setup steps.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                localStorage.removeItem('onboarding_completed');
                navigate('/onboarding');
              }}
            >
              Reset Setup
            </Button>
          </div>
        </div>
      </div>

      {/* ── SECTION 4: Danger Zone ────────────────────────────────────── */}
      <div className="bg-card border border-destructive/20 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-danger-text flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-danger-text" />
            <span>Danger Zone</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Irreversible workspace settings.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2 justify-between">
          {!isOwner && (
            <div className="flex items-center justify-between w-full border border-border rounded-lg p-3 bg-sunken/45">
              <div>
                <p className="text-xs font-semibold text-foreground">Leave Workspace</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  You will lose access to all campaigns in this workspace.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setLeaveOpen(true)}
                className="gap-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Leave</span>
              </Button>
            </div>
          )}

          {isOwner && (
            <div className="flex items-center justify-between w-full border border-destructive/20 rounded-lg p-3 bg-destructive/[0.02]">
              <div>
                <p className="text-xs font-semibold text-danger-text">Delete Workspace</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Permanently delete this workspace and all associated CRM data.
                </p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                Delete Workspace
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {isAdmin && (
        <>
          <RenameWorkspaceDialog
            open={renameOpen}
            onOpenChange={setRenameOpen}
            workspaceId={activeWorkspace.id || ''}
            currentName={activeWorkspace.name}
          />
          <InviteMemberDialog
            open={inviteOpen}
            onOpenChange={setInviteOpen}
            workspaceId={activeWorkspace.id || ''}
          />
        </>
      )}

      {isOwner && (
        <DeleteWorkspaceDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          workspaceId={activeWorkspace.id || ''}
          workspaceName={activeWorkspace.name}
        />
      )}

      {!isOwner && (
        <LeaveWorkspaceDialog
          open={leaveOpen}
          onOpenChange={setLeaveOpen}
          workspaceId={activeWorkspace.id || ''}
          workspaceName={activeWorkspace.name}
        />
      )}

      {transferTarget && (
        <TransferOwnershipDialog
          open={transferOpen}
          onOpenChange={setTransferOpen}
          workspaceId={activeWorkspace.id || ''}
          newOwnerId={transferTarget.id}
          newOwnerName={transferTarget.name}
          onSuccess={() => setTransferTarget(null)}
        />
      )}
    </div>
  );
}

function LinkedInIntegrationCard({ workspaceId }: { workspaceId: string }) {
  const [cookie, setCookie] = React.useState('');
  const [status, setStatus] = React.useState<{ configured: boolean; preview: string }>({
    configured: false,
    preview: ''
  });
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ valid: boolean; message: string } | null>(
    null
  );
  const [saving, setSaving] = React.useState(false);

  const fetchStatus = React.useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await window.ipc.invoke('linkedin:get-cookie-status', { workspaceId });
      setStatus(res);
    } catch {
      // Ignore
    }
  }, [workspaceId]);

  React.useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cookie.trim()) return;
    setSaving(true);
    try {
      await window.ipc.invoke('linkedin:save-cookie', { workspaceId, cookie: cookie.trim() });
      setCookie('');
      setTestResult(null);
      await fetchStatus();
    } catch (err: any) {
      alert(`Failed to save cookie: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const payload = cookie.trim() ? { cookie: cookie.trim() } : {};
      const res = await window.ipc.invoke('linkedin:validate', payload);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ valid: false, message: `Test error: ${err.message || err}` });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-card border border-border-subtle rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Linkedin className="w-4 h-4 text-blue-400" />
            <span>LinkedIn Executive Enrichment</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Store your LinkedIn session cookie (
            <code className="font-mono text-[10px] bg-sunken px-1 py-0.5 rounded">li_at</code>) to
            automatically scrape executive decision-makers (CEOs, VPs, Directors).
          </p>
        </div>
        <div>
          {status.configured ? (
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Configured ({status.preview})
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">
              Not Configured
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-3 pt-1">
        <div className="space-y-1">
          <label
            htmlFor="liCookieInput"
            className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block"
          >
            LinkedIn Session Cookie (li_at)
          </label>
          <div className="flex gap-2">
            <input
              id="liCookieInput"
              type="password"
              placeholder={
                status.configured
                  ? 'Paste new li_at cookie to update...'
                  : 'AQED... (paste li_at cookie value from DevTools)'
              }
              value={cookie}
              onChange={(e) => setCookie(e.target.value)}
              className="flex-1 bg-sunken border border-border rounded px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Test Cookie'}
            </Button>
            <Button type="submit" size="sm" disabled={saving || !cookie.trim()}>
              {saving ? 'Saving...' : 'Save Cookie'}
            </Button>
          </div>
        </div>

        {testResult && (
          <div
            className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
              testResult.valid
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-destructive/10 text-destructive border-destructive/20'
            }`}
          >
            {testResult.valid ? (
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-semibold">
                {testResult.valid ? 'Session Active' : 'Validation Failed'}
              </div>
              <div className="text-[11px] opacity-90">{testResult.message}</div>
            </div>
          </div>
        )}

        <div className="bg-sunken/40 border border-border-subtle rounded-lg p-3 text-[10px] text-muted-foreground space-y-1">
          <div className="font-semibold text-foreground flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-accent" />
            How to get your li_at cookie:
          </div>
          <div>1. Log into LinkedIn in Google Chrome or Edge</div>
          <div>
            2. Press <code className="font-mono bg-sunken px-1 rounded text-foreground">F12</code> →
            Open <strong>Application</strong> tab → <strong>Cookies</strong> →{' '}
            <code className="font-mono text-foreground">https://www.linkedin.com</code>
          </div>
          <div>
            3. Find <code className="font-mono bg-sunken px-1 rounded text-foreground">li_at</code>{' '}
            → Copy the Cookie Value → Paste here
          </div>
        </div>
      </form>
    </div>
  );
}

function AutoUpdateSection() {
  const [status, setStatus] = useState<any>({
    status: 'idle',
    progress: 0,
    currentVersion: '0.0.1',
    availableVersion: '',
    releaseNotes: '',
    channel: 'stable'
  });
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await window.ipc.invoke('updater:get-status', undefined);
      setStatus(res);
    } catch {}
  };

  React.useEffect(() => {
    fetchStatus();

    const unsubscribe = window.ipc.on('updater:status-changed' as any, (newStatus: any) => {
      setStatus(newStatus);
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const handleCheck = async () => {
    setChecking(true);
    try {
      const res = await window.ipc.invoke('updater:check', undefined);
      if (res.updateAvailable) {
        alert(`Update v${res.version} is available!`);
      } else {
        alert('You are already running the latest version.');
      }
      await fetchStatus();
    } catch (err: any) {
      alert(`Check failed: ${err.message || err}`);
    } finally {
      setChecking(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await window.ipc.invoke('updater:download', undefined);
      await fetchStatus();
    } catch (err: any) {
      alert(`Download failed: ${err.message || err}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleInstall = async () => {
    try {
      await window.ipc.invoke('updater:install', undefined);
    } catch (err: any) {
      alert(`Installation failed: ${err.message || err}`);
    }
  };

  return (
    <div className="bg-card border border-border-subtle rounded-xl p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-accent" />
          <span>Application Updates</span>
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Verify and install latest features, patches, and security updates for LeadForge OS.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
            Current Version
          </span>
          <p className="text-xs font-semibold text-foreground">v{status.currentVersion}</p>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
            Release Channel
          </span>
          <p className="text-xs font-mono text-muted-foreground capitalize">{status.channel}</p>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
            Updater Status
          </span>
          <p className="text-xs font-semibold text-foreground capitalize">{status.status}</p>
        </div>
      </div>

      {status.status === 'available' && (
        <div className="bg-accent/5 border border-accent/15 rounded-lg p-3 text-xs flex items-center justify-between">
          <div>
            <div className="font-semibold text-foreground">
              New Version Available: v{status.availableVersion}
            </div>
            {status.releaseNotes && (
              <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                {status.releaseNotes}
              </div>
            )}
          </div>
          <Button size="sm" onClick={handleDownload} disabled={downloading}>
            {downloading ? 'Downloading...' : 'Download Update'}
          </Button>
        </div>
      )}

      {status.status === 'downloading' && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-bold text-muted-foreground">
            <span>Downloading Update...</span>
            <span>{status.progress}%</span>
          </div>
          <div className="w-full bg-sunken rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-accent h-1.5 transition-all duration-300"
              style={{ width: `${status.progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {status.status === 'ready' && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-xs flex items-center justify-between">
          <div>
            <div className="font-semibold text-emerald-400">Update Downloaded & Verified</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Ready to install on restart.
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleInstall}
            className="bg-emerald-600 hover:bg-emerald-700 text-white border-none"
          >
            Restart & Install
          </Button>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button variant="outline" size="sm" onClick={handleCheck} disabled={checking}>
          {checking ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Check for Updates'}
        </Button>
      </div>
    </div>
  );
}
