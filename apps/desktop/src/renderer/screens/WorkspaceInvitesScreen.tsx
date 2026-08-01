import React from 'react';
import { useWorkspaceInvites, useAcceptInvite, useDeclineInvite } from '../hooks/useWorkspaceQuery';
import { useWorkspace } from '../hooks/useWorkspace';
import { Button } from '../components/ui/button';
import { UserAvatar } from '../components/ui/UserAvatar';
import { Sparkles, Check, X } from 'lucide-react';

import type { Workspace, WorkspaceMember } from '@leadforge/schema';

/**
 * WorkspaceInvitesScreen displays pending workspace invitations sent to the user.
 * Enables acceptance and rejection of invitations with automatic list refresh.
 */
export default function WorkspaceInvitesScreen() {
  const invitesQuery = useWorkspaceInvites();
  const acceptMutation = useAcceptInvite();
  const declineMutation = useDeclineInvite();
  const { setActive } = useWorkspace();

  const handleAccept = async (token: string) => {
    try {
      const workspace = await acceptMutation.mutateAsync(token);
      // Automatically switch to the newly accepted workspace
      await setActive(workspace as unknown as any);
    } catch {}
  };

  const handleDecline = async (token: string) => {
    try {
      await declineMutation.mutateAsync(token);
    } catch {}
  };

  if (invitesQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-xs text-muted-foreground">
        Loading invitations...
      </div>
    );
  }

  const invites = (invitesQuery.data || []) as Workspace[];

  if (invites.length === 0) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto text-accent">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">No pending invitations</p>
          <p className="text-xs text-muted-foreground mt-1">
            You don&apos;t have any workspace invitations waiting for approval.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6 font-sans">
      <div className="border-b border-border-subtle pb-4">
        <h1 className="text-lg font-bold text-foreground">Pending Invitations</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Choose which workspaces you want to join and collaborate in.
        </p>
      </div>

      <div className="space-y-3">
        {invites.map((ws) => {
          // Find the pending member item for current user
          const inviteMember = ws.members?.find((m: WorkspaceMember) => m.status === 'PENDING');
          const token = inviteMember?.invitationToken || '';

          return (
            <div
              key={ws.id}
              className="flex items-center justify-between p-4 bg-card border border-border-subtle rounded-xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded bg-accent/10 flex items-center justify-center text-accent shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-foreground leading-tight">{ws.name}</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Invited to join as{' '}
                    <span className="font-medium text-foreground">{inviteMember?.role}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] gap-1 hover:bg-danger-bg hover:text-danger-text"
                  onClick={() => handleDecline(token)}
                  disabled={declineMutation.isPending || acceptMutation.isPending}
                >
                  <X className="w-3 h-3" />
                  <span>Decline</span>
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-[10px] gap-1"
                  onClick={() => handleAccept(token)}
                  disabled={declineMutation.isPending || acceptMutation.isPending}
                >
                  <Check className="w-3 h-3" />
                  <span>Accept</span>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
