import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { WorkspaceRole } from '@leadforge/schema';
import {
  useInviteMember,
  useLeaveWorkspace,
  useTransferOwnership
} from '../../hooks/useWorkspaceQuery';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from './dialog';
import { Button } from './button';

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: z.nativeEnum(WorkspaceRole)
});
type InviteFormValues = z.infer<typeof inviteSchema>;

// ---------------------------------------------------------------------------
// Invite Member Dialog
// ---------------------------------------------------------------------------

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}

export function InviteMemberDialog({ open, onOpenChange, workspaceId }: InviteMemberDialogProps) {
  const inviteMutation = useInviteMember(workspaceId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: WorkspaceRole.MEMBER }
  });

  const onSubmit = async (values: InviteFormValues) => {
    try {
      await inviteMutation.mutateAsync(values);
      reset();
      onOpenChange(false);
    } catch {}
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite team member</DialogTitle>
          <DialogDescription>
            Invite collaborators to this workspace with specific roles and permissions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label htmlFor="invite-email" className="text-xs font-medium text-foreground">
              Work email address
            </label>
            <input
              id="invite-email"
              type="email"
              placeholder="name@company.com"
              {...register('email')}
              className="w-full px-3 py-2 rounded-md border border-border bg-input text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {errors.email && <p className="text-[10px] text-danger-text">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="invite-role" className="text-xs font-medium text-foreground">
              Workspace role
            </label>
            <select
              id="invite-role"
              {...register('role')}
              className="w-full px-3 py-2 rounded-md border border-border bg-input text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value={WorkspaceRole.MEMBER}>Member (can build campaigns)</option>
              <option value={WorkspaceRole.ADMIN}>Administrator (can manage workspace)</option>
              <option value={WorkspaceRole.READ_ONLY}>Read Only (view settings)</option>
              <option value={WorkspaceRole.BILLING}>Billing (view invoice and plan)</option>
            </select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Sending invite...' : 'Send invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Leave Workspace Dialog
// ---------------------------------------------------------------------------

interface LeaveWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceName: string;
  onSuccess?: () => void;
}

export function LeaveWorkspaceDialog({
  open,
  onOpenChange,
  workspaceId,
  workspaceName,
  onSuccess
}: LeaveWorkspaceDialogProps) {
  const leaveMutation = useLeaveWorkspace(workspaceId);
  const [confirmText, setConfirmText] = useState('');

  const handleLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmText !== 'LEAVE') return;

    try {
      await leaveMutation.mutateAsync();
      onOpenChange(false);
      onSuccess?.();
    } catch {}
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Leave Workspace</DialogTitle>
          <DialogDescription>
            You will lose access to all campaigns, templates, and data within{' '}
            <strong className="text-foreground">{workspaceName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleLeave} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              Type <strong className="text-foreground">LEAVE</strong> below to confirm.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 rounded-md border border-border bg-input text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={confirmText !== 'LEAVE' || leaveMutation.isPending}
            >
              {leaveMutation.isPending ? 'Leaving...' : 'Leave workspace'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Transfer Ownership Dialog
// ---------------------------------------------------------------------------

interface TransferOwnershipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  newOwnerId: string;
  newOwnerName: string;
  onSuccess?: () => void;
}

export function TransferOwnershipDialog({
  open,
  onOpenChange,
  workspaceId,
  newOwnerId,
  newOwnerName,
  onSuccess
}: TransferOwnershipDialogProps) {
  const transferMutation = useTransferOwnership(workspaceId);
  const [confirmText, setConfirmText] = useState('');

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmText !== 'TRANSFER') return;

    try {
      await transferMutation.mutateAsync(newOwnerId);
      onOpenChange(false);
      onSuccess?.();
    } catch {}
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Transfer Ownership</DialogTitle>
          <DialogDescription>
            You are transferring the ownership of this workspace to{' '}
            <strong className="text-foreground">{newOwnerName}</strong>. You will be demoted to
            Administrator.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleTransfer} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              Type <strong className="text-foreground">TRANSFER</strong> below to confirm.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 rounded-md border border-border bg-input text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={confirmText !== 'TRANSFER' || transferMutation.isPending}
            >
              {transferMutation.isPending ? 'Transferring...' : 'Transfer ownership'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
