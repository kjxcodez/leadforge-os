import { HttpClient } from '../http/client.js';
import type { Attachment } from '@leadforge/schema';

export interface UploadAttachmentPayload {
  googleConnectionId: string;
  filename: string;
  mimeType: string;
  contentBase64: string;
  metadata?: Record<string, any>;
}

export interface DownloadAttachmentResult {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  contentBase64: string;
}

export class AttachmentsModule {
  constructor(private readonly client: HttpClient) {}

  public async list(): Promise<Attachment[]> {
    return this.client.get<Attachment[]>('/attachments');
  }

  public async get(id: string): Promise<Attachment> {
    return this.client.get<Attachment>(`/attachments/${id}`);
  }

  public async upload(payload: UploadAttachmentPayload): Promise<Attachment> {
    return this.client.post<Attachment>('/attachments/upload', payload);
  }

  public async download(id: string): Promise<DownloadAttachmentResult> {
    return this.client.get<DownloadAttachmentResult>(`/attachments/${id}/download`);
  }

  public async delete(id: string): Promise<{ success: boolean }> {
    return this.client.delete<{ success: boolean }>(`/attachments/${id}`);
  }
}
