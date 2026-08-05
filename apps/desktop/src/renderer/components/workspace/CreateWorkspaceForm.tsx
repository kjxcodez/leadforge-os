import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useWorkspace } from '../../hooks/useWorkspace';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

const schema = z.object({
  name: z.string().min(2, 'Workspace name must be at least 2 characters')
});

type FormValues = z.infer<typeof schema>;

interface CreateWorkspaceFormProps {
  /** Optional callback fired when the workspace is successfully created. */
  onSuccess?: () => void;
  /** Optional callback. If provided, renders a secondary 'Cancel' button beside the submit. */
  onCancel?: () => void;
}

/**
 * CreateWorkspaceForm — reusable form for workspace creation.
 *
 * Serves as the single source of truth for workspace creation inputs.
 * Composed inside:
 *   1. AppLayout (inline fullscreen onboarding prompt when activeWorkspace is null)
 *   2. CreateWorkspaceDialog (modal switcher trigger)
 */
export function CreateWorkspaceForm({ onSuccess, onCancel }: CreateWorkspaceFormProps) {
  const { createWorkspace } = useWorkspace();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '' }
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await createWorkspace(values.name);
      toast.success('Workspace created successfully.');
      reset();
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create workspace.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left" noValidate>
      <div className="space-y-1.5">
        <Label
          htmlFor="ws-name"
          className="text-[12px] font-medium tracking-[0.04em] uppercase text-muted-foreground"
        >
          Workspace Name
        </Label>
        <Input
          id="ws-name"
          type="text"
          placeholder="e.g. Acme Corp"
          aria-invalid={!!errors.name}
          {...register('name')}
        />
        {errors.name && (
          <p className="text-[11px] text-danger leading-none" role="alert">
            {errors.name.message}
          </p>
        )}
      </div>

      {onCancel ? (
        <div className="flex justify-end gap-2 pt-2 border-t border-transparent">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create workspace'}
          </Button>
        </div>
      ) : (
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create workspace'}
        </Button>
      )}
    </form>
  );
}
