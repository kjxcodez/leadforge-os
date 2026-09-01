import { HttpClient } from '../http/client.js';
import { toQueryString } from '../utils/query.js';
import type {
  EmailDelivery,
  CreateEmailDeliveryDto,
  BulkEmailDeliveryDto,
  UpdateEmailDeliveryDto,
  ReserveEmailDeliveryDto,
  FinalizeEmailDeliveryDto,
  BulkOperationResult
} from '@leadforge/schema';

export class EmailDeliveriesModule {
  constructor(private client: HttpClient) {}

  public async list(params?: {
    page?: number;
    limit?: number;
    campaignId?: string;
    sequenceId?: string;
    status?: string;
  }): Promise<{ data: EmailDelivery[]; total: number }> {
    const queryParams = toQueryString(params);
    return this.client.get<{ data: EmailDelivery[]; total: number }>(`/email-deliveries${queryParams}`);
  }

  public async get(id: string): Promise<EmailDelivery> {
    return this.client.get<EmailDelivery>(`/email-deliveries/${id}`);
  }

  public async getAmbiguous(): Promise<EmailDelivery[]> {
    return this.client.get<EmailDelivery[]>('/email-deliveries/ambiguous');
  }

  public async getByIdempotencyKey(key: string): Promise<EmailDelivery> {
    return this.client.get<EmailDelivery>(`/email-deliveries/by-idempotency/${key}`);
  }

  public async reserve(
    dto: ReserveEmailDeliveryDto
  ): Promise<{ delivery: EmailDelivery; isAlreadySent: boolean }> {
    return this.client.post<{ delivery: EmailDelivery; isAlreadySent: boolean }>(
      '/email-deliveries/reserve',
      dto
    );
  }

  public async finalize(id: string, dto: FinalizeEmailDeliveryDto): Promise<EmailDelivery> {
    return this.client.post<EmailDelivery>(`/email-deliveries/${id}/finalize`, dto);
  }

  public async reconcile(options?: { maxAgeMs?: number }): Promise<{ diagnosedCount: number; deliveries: EmailDelivery[] }> {
    return this.client.post<{ diagnosedCount: number; deliveries: EmailDelivery[] }>(
      '/email-deliveries/reconcile',
      options || {}
    );
  }

  public async create(dto: CreateEmailDeliveryDto): Promise<EmailDelivery> {
    return this.client.post<EmailDelivery>('/email-deliveries', dto);
  }

  public async createBulk(dto: BulkEmailDeliveryDto): Promise<BulkOperationResult<EmailDelivery>> {
    return this.client.post<BulkOperationResult<EmailDelivery>>('/email-deliveries/bulk', dto);
  }

  public async updateStatus(id: string, dto: UpdateEmailDeliveryDto): Promise<EmailDelivery> {
    return this.client.patch<EmailDelivery>(`/email-deliveries/${id}/status`, dto);
  }
}
