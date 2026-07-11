import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from './useWorkspace';
import {
  SyncSequenceRepository,
  SyncSequenceExecutionRepository,
  SyncSequenceLogRepository
} from '../repositories/sync';
import { toast } from 'sonner';

export function useSequences() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || '';

  return useQuery({
    queryKey: ['sequences', 'list', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      return SyncSequenceRepository.listAndSync(workspaceId);
    },
    enabled: !!workspaceId,
  });
}

export function useSequence(id: string) {
  return useQuery({
    queryKey: ['sequences', 'detail', id],
    queryFn: async () => {
      if (!id) return null;
      return SyncSequenceRepository.findById(id);
    },
    enabled: !!id,
  });
}

export function useSequenceExecutions() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || '';

  return useQuery({
    queryKey: ['sequence_executions', 'list', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      return SyncSequenceExecutionRepository.listAndSync(workspaceId);
    },
    enabled: !!workspaceId,
  });
}

export function useSequenceExecution(id: string) {
  return useQuery({
    queryKey: ['sequence_executions', 'detail', id],
    queryFn: async () => {
      if (!id) return null;
      return SyncSequenceExecutionRepository.findById(id);
    },
    enabled: !!id,
  });
}

export function useSequenceLogs(executionId: string) {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || '';

  return useQuery({
    queryKey: ['sequence_logs', 'list', workspaceId, executionId],
    queryFn: async () => {
      if (!workspaceId || !executionId) return [];
      return SyncSequenceLogRepository.listAndSync(workspaceId, { executionId });
    },
    enabled: !!workspaceId && !!executionId,
  });
}

export function useStartSequence() {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || '';

  return useMutation({
    mutationFn: async ({
      sequenceId,
      contactId,
      companyId,
    }: {
      sequenceId: string;
      contactId?: string | null;
      companyId?: string | null;
    }) => {
      return SyncSequenceExecutionRepository.create({
        sequenceId,
        contactId,
        companyId,
        workspaceId,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequence_executions', 'list', workspaceId] });
      toast.success('Sequence execution started.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to start sequence execution.');
    },
  });
}

export function useStopSequence() {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || '';

  return useMutation({
    mutationFn: async (id: string) => {
      return SyncSequenceExecutionRepository.update(id, { status: 'STOPPED', workspaceId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequence_executions', 'list', workspaceId] });
      toast.success('Sequence execution stopped.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to stop sequence execution.');
    },
  });
}
