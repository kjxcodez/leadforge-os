import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useWorkspace } from '../../hooks/useWorkspace';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from './dialog';
import { Button } from './button';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters')
});
type WorkspaceFormValues = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Create Workspace Dialog
// ---------------------------------------------------------------------------

interface CreateWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  onSuccess
}: CreateWorkspaceDialogProps) {
  const { createWorkspace } = useWorkspace();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<WorkspaceFormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: WorkspaceFormValues) => {
    try {
      await createWorkspace(values.name);
      toast.success('Workspace created successfully.');
      reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create workspace.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Workspace</DialogTitle>
          <DialogDescription>
            Workspaces keep your contacts, campaigns, and settings separate.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label htmlFor="ws-create-name" className="text-xs font-medium text-foreground">
              Workspace name
            </label>
            <input
              id="ws-create-name"
              type="text"
              placeholder="e.g. Acme Sales Team"
              {...register('name')}
              className="w-full px-3 py-2 rounded-md border border-border bg-input text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {errors.name && <p className="text-[10px] text-danger-text">{errors.name.message}</p>}
          </div>

          <DialogFooter className="bg-transparent">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create workspace'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Rename Workspace Dialog
// ---------------------------------------------------------------------------

interface RenameWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  currentName: string;
  onSuccess?: () => void;
}

export function RenameWorkspaceDialog({
  open,
  onOpenChange,
  workspaceId,
  currentName,
  onSuccess
}: RenameWorkspaceDialogProps) {
  const { updateWorkspace } = useWorkspace();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<WorkspaceFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: currentName }
  });

  const onSubmit = async (values: WorkspaceFormValues) => {
    try {
      await updateWorkspace(workspaceId, { name: values.name });
      toast.success('Workspace renamed successfully.');
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to rename workspace.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename Workspace</DialogTitle>
          <DialogDescription>
            Change the name of this workspace. This will also update the slug.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label htmlFor="ws-rename-name" className="text-xs font-medium text-foreground">
              Workspace name
            </label>
            <input
              id="ws-rename-name"
              type="text"
              placeholder="e.g. Acme Sales Team"
              {...register('name')}
              className="w-full px-3 py-2 rounded-md border border-border bg-input text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {errors.name && <p className="text-[10px] text-danger-text">{errors.name.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Renaming...' : 'Rename'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Delete Workspace Dialog
// ---------------------------------------------------------------------------

interface DeleteWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceName: string;
  onSuccess?: () => void;
}

export function DeleteWorkspaceDialog({
  open,
  onOpenChange,
  workspaceId,
  workspaceName,
  onSuccess
}: DeleteWorkspaceDialogProps) {
  const { deleteWorkspace } = useWorkspace();
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmText !== workspaceName) return;

    setIsDeleting(true);
    try {
      await deleteWorkspace(workspaceId);
      toast.success('Workspace deleted successfully.');
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete workspace.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-danger-text">Delete Workspace</DialogTitle>
          <DialogDescription>
            This action is irreversible. All contacts, campaigns, and settings will be permanently
            lost.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleDelete} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Type <strong className="text-foreground">{workspaceName}</strong> below to confirm.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
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
              disabled={confirmText !== workspaceName || isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete workspace'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
