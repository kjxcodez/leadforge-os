import React, { useState } from 'react';
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
import { InviteMemberDialog, LeaveWorkspaceDialog, TransferOwnershipDialog } from '../components/ui/MemberDialogs';
import { WorkspaceRole, WorkspaceMemberStatus, type WorkspaceMember } from '@leadforge/schema';
import { ShieldAlert, Trash2, UserPlus, LogOut, ArrowLeftRight, Key, CheckCircle, AlertCircle, RefreshCw, Linkedin, Sparkles } from 'lucide-react';

/**
 * WorkspaceSettingsScreen enables team management, invitation oversight,
 * role adjustments, ownership transfer, and workspace settings updates.
 */
export default function WorkspaceSettingsScreen() {
  const { activeWorkspace } = useWorkspace();
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
            <p className="text-xs text-muted-foreground mt-0.5">Basic details for this workspace.</p>
          </div>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setRenameOpen(true)}>
              Rename
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Workspace Name</span>
            <p className="text-xs font-medium text-foreground">{activeWorkspace.name}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Unique URL Slug</span>
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
            {(membersQuery.data as WorkspaceMember[] || []).map((m) => {
              const emailStr = m.email || '';
              const memberName = emailStr.split('@')[0] || 'User';
              const isSelf = m.userId === activeWorkspace.ownerId; // placeholder check

              return (
                <div key={m.id || m.userId || m.email} className="flex items-center justify-between py-3">
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
                      <span className="text-[10px] text-muted-foreground">Joined {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : 'N/A'}</span>
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
                    {isOwner && m.role !== WorkspaceRole.OWNER && m.status === WorkspaceMemberStatus.ACTIVE && (
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
                <p className="text-[10px] text-muted-foreground mt-0.5">You will lose access to all campaigns in this workspace.</p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setLeaveOpen(true)} className="gap-1">
                <LogOut className="w-3.5 h-3.5" />
                <span>Leave</span>
              </Button>
            </div>
          )}

          {isOwner && (
            <div className="flex items-center justify-between w-full border border-destructive/20 rounded-lg p-3 bg-destructive/[0.02]">
              <div>
                <p className="text-xs font-semibold text-danger-text">Delete Workspace</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Permanently delete this workspace and all associated CRM data.</p>
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
  const [status, setStatus] = React.useState<{ configured: boolean; preview: string }>({ configured: false, preview: '' });
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ valid: boolean; message: string } | null>(null);
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
            Store your LinkedIn session cookie (<code className="font-mono text-[10px] bg-sunken px-1 py-0.5 rounded">li_at</code>) to automatically scrape executive decision-makers (CEOs, VPs, Directors).
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
          <label htmlFor="liCookieInput" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
            LinkedIn Session Cookie (li_at)
          </label>
          <div className="flex gap-2">
            <input
              id="liCookieInput"
              type="password"
              placeholder={status.configured ? 'Paste new li_at cookie to update...' : 'AQED... (paste li_at cookie value from DevTools)'}
              value={cookie}
              onChange={(e) => setCookie(e.target.value)}
              className="flex-1 bg-sunken border border-border rounded px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Button type="button" variant="outline" size="sm" onClick={handleTest} disabled={testing}>
              {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Test Cookie'}
            </Button>
            <Button type="submit" size="sm" disabled={saving || !cookie.trim()}>
              {saving ? 'Saving...' : 'Save Cookie'}
            </Button>
          </div>
        </div>

        {testResult && (
          <div className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
            testResult.valid
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-destructive/10 text-destructive border-destructive/20'
          }`}>
            {testResult.valid ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            <div>
              <div className="font-semibold">{testResult.valid ? 'Session Active' : 'Validation Failed'}</div>
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
          <div>2. Press <code className="font-mono bg-sunken px-1 rounded text-foreground">F12</code> → Open <strong>Application</strong> tab → <strong>Cookies</strong> → <code className="font-mono text-foreground">https://www.linkedin.com</code></div>
          <div>3. Find <code className="font-mono bg-sunken px-1 rounded text-foreground">li_at</code> → Copy the Cookie Value → Paste here</div>
        </div>
      </form>
    </div>
  );
}
