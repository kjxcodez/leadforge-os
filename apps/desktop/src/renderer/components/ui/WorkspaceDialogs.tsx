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
import { Input } from './input';
import { Label } from './label';
import { CreateWorkspaceForm } from '../workspace/CreateWorkspaceForm';

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm rounded-none bg-background">
        <DialogHeader>
          <DialogTitle>Create Workspace</DialogTitle>
          <DialogDescription>
            Workspaces keep your contacts, campaigns, and settings separate.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <CreateWorkspaceForm
            onSuccess={() => {
              onOpenChange(false);
              onSuccess?.();
            }}
            onCancel={() => onOpenChange(false)}
          />
        </div>
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
      <DialogContent className="sm:max-w-sm rounded-none bg-background">
        <DialogHeader>
          <DialogTitle>Rename Workspace</DialogTitle>
          <DialogDescription>
            Change the name of this workspace. This will also update the slug.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2" noValidate>
          <div className="space-y-1.5">
            <Label
              htmlFor="ws-rename-name"
              className="text-[12px] font-medium tracking-[0.04em] uppercase text-muted-foreground"
            >
              Workspace name
            </Label>
            <Input
              id="ws-rename-name"
              type="text"
              placeholder="e.g. Acme Sales Team"
              aria-invalid={!!errors.name}
              {...register('name')}
            />
            {errors.name && (
              <p className="text-[11px] text-danger leading-none" role="alert">
                {errors.name.message}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
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
      <DialogContent className="sm:max-w-sm rounded-none bg-background">
        <DialogHeader>
          <DialogTitle className="text-danger">Delete Workspace</DialogTitle>
          <DialogDescription>
            This action is irreversible. All contacts, campaigns, and settings will be permanently
            lost.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleDelete} className="space-y-4 py-2" noValidate>
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Type <strong className="text-foreground">{workspaceName}</strong> below to confirm.
            </p>
            <Input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={workspaceName}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
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
