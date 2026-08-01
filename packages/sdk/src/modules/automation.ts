import { HttpClient } from '../http/client';
import type {
  Sequence,
  CreateSequenceDto,
  UpdateSequenceDto,
  SequenceExecution,
  SequenceLog
} from '@leadforge/schema';

export class SequencesModule {
  constructor(private client: HttpClient) {}

  public async list(): Promise<Sequence[]> {
    return this.client.get<Sequence[]>('/automation/sequences');
  }

  public async get(id: string): Promise<Sequence> {
    return this.client.get<Sequence>(`/automation/sequences/${id}`);
  }

  public async create(dto: CreateSequenceDto): Promise<Sequence> {
    return this.client.post<Sequence>('/automation/sequences', dto);
  }

  public async update(id: string, dto: UpdateSequenceDto): Promise<Sequence> {
    return this.client.patch<Sequence>(`/automation/sequences/${id}`, dto);
  }

  public async delete(id: string): Promise<void> {
    return this.client.delete<void>(`/automation/sequences/${id}`);
  }
}

export class ExecutionsModule {
  constructor(private client: HttpClient) {}

  public async list(): Promise<SequenceExecution[]> {
    return this.client.get<SequenceExecution[]>('/automation/executions');
  }

  public async get(id: string): Promise<SequenceExecution> {
    return this.client.get<SequenceExecution>(`/automation/executions/${id}`);
  }

  public async start(
    sequenceId: string,
    contactId?: string | null,
    companyId?: string | null
  ): Promise<SequenceExecution> {
    return this.client.post<SequenceExecution>('/automation/executions/start', {
      sequenceId,
      contactId,
      companyId
    });
  }

  public async stop(id: string): Promise<SequenceExecution> {
    return this.client.post<SequenceExecution>(`/automation/executions/${id}/stop`, {});
  }

  public async getLogs(id: string): Promise<SequenceLog[]> {
    return this.client.get<SequenceLog[]>(`/automation/executions/${id}/logs`);
  }
}
