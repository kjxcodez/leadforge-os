import { createHash } from 'crypto';
import { AttachmentRepository } from '../../repositories/attachment/attachment.repository.js';
import { GoogleConnectionRepository } from '../../repositories/google-connection/google-connection.repository.js';
import { GoogleDriveProvider } from '../google/drive.provider.js';
import { GoogleAuthService } from '../google/auth.service.js';
import { AttachmentDomainError } from './types.js';
import type { AttachmentDocument } from '../../db/models/attachment.model.js';

export interface UploadAttachmentOptions {
  googleConnectionId: string;
  filename: string;
  mimeType: string;
  data: Buffer;
  metadata?: Record<string, any> | undefined;
}

export interface ListAttachmentsOptions {
  search?: string | undefined;
  category?: string | undefined;
  connectionId?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export class AttachmentService {
  private readonly attachmentRepo: AttachmentRepository;
  private readonly connectionRepo: GoogleConnectionRepository;
  private readonly driveProvider: GoogleDriveProvider;

  constructor(private readonly workspaceId: string) {
    this.attachmentRepo = new AttachmentRepository(workspaceId);
    this.connectionRepo = new GoogleConnectionRepository(workspaceId);
    const authService = new GoogleAuthService();
    this.driveProvider = new GoogleDriveProvider(authService);
  }

  /**
   * Uploads an attachment to Google Drive and persists metadata in MongoDB.
   */
  public async upload(options: UploadAttachmentOptions): Promise<AttachmentDocument> {
    if (options.data.length > 25 * 1024 * 1024) {
      throw new AttachmentDomainError('ATTACHMENT_SIZE_EXCEEDED', 'Attachment size exceeds maximum limit of 25 MB.', 413);
    }

    const connection = await this.connectionRepo.findById(options.googleConnectionId);
    if (!connection) {
      throw new AttachmentDomainError(
        'DRIVE_CONNECTION_NOT_FOUND',
        `Google connection "${options.googleConnectionId}" not found in this workspace.`,
        404
      );
    }

    if (connection.status === 'disconnected') {
      throw new AttachmentDomainError(
        'DRIVE_AUTH_REQUIRED',
        `Google connection "${connection.email}" is disconnected. Please reconnect Google Drive.`,
        401
      );
    }

    if (connection.driveStatus !== 'authorized') {
      throw new AttachmentDomainError(
        'DRIVE_AUTH_REQUIRED',
        `Google Drive is not authorized for account "${connection.email}". Please connect Google Drive in Settings.`,
        401
      );
    }

    // Compute content hash
    const contentHash = createHash('sha256').update(options.data).digest('hex');

    // Upload binary to Google Drive
    const driveResult = await this.driveProvider.uploadFile({
      connectionId: options.googleConnectionId,
      filename: options.filename,
      mimeType: options.mimeType,
      data: options.data
    });

    const driveUrl = driveResult.driveUrl || driveResult.webViewLink || `https://drive.google.com/file/d/${driveResult.fileId}/view`;

    // Persist canonical metadata record in MongoDB
    const attachment = await this.attachmentRepo.create({
      workspaceId: this.workspaceId,
      provider: 'google-drive',
      googleConnectionId: options.googleConnectionId,
      googleAccountId: connection.googleAccountId,
      fileId: driveResult.fileId,
      filename: driveResult.filename,
      mimeType: driveResult.mimeType,
      size: driveResult.size,
      driveUrl,
      thumbnailUrl: driveResult.thumbnailLink || null,
      contentHash,
      metadata: options.metadata || {}
    } as any);

    return attachment;
  }

  /**
   * Links an existing Google Drive file into workspace attachments.
   */
  public async linkDriveFile(googleConnectionId: string, fileId: string): Promise<AttachmentDocument> {
    const connection = await this.connectionRepo.findById(googleConnectionId);
    if (!connection) {
      throw new AttachmentDomainError(
        'DRIVE_CONNECTION_NOT_FOUND',
        `Google connection "${googleConnectionId}" not found in this workspace.`,
        404
      );
    }

    if (connection.status === 'disconnected' || connection.driveStatus !== 'authorized') {
      throw new AttachmentDomainError(
        'DRIVE_AUTH_REQUIRED',
        `Google Drive is not connected or authorized for account "${connection.email}".`,
        401
      );
    }

    // Check if already registered in workspace
    const existing = await this.attachmentRepo.findOne({
      workspaceId: this.workspaceId,
      fileId
    } as any);
    if (existing) {
      return existing;
    }

    const meta = await this.driveProvider.getFileMetadata(googleConnectionId, fileId);
    const driveUrl = meta.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

    const attachment = await this.attachmentRepo.create({
      workspaceId: this.workspaceId,
      provider: 'google-drive',
      googleConnectionId,
      googleAccountId: connection.googleAccountId,
      fileId,
      filename: meta.name,
      mimeType: meta.mimeType,
      size: meta.size,
      driveUrl,
      thumbnailUrl: meta.thumbnailLink || null,
      metadata: {}
    } as any);

    return attachment;
  }

  public async get(id: string): Promise<AttachmentDocument | null> {
    return this.attachmentRepo.findById(id);
  }

  public async list(options?: ListAttachmentsOptions): Promise<AttachmentDocument[]> {
    const filter: Record<string, any> = { workspaceId: this.workspaceId };

    if (options?.connectionId) {
      filter.googleConnectionId = options.connectionId;
    }

    if (options?.search) {
      filter.filename = { $regex: options.search, $options: 'i' };
    }

    if (options?.category) {
      const cat = options.category.toLowerCase();
      if (cat === 'image' || cat === 'images') {
        filter.mimeType = { $regex: '^image/', $options: 'i' };
      } else if (cat === 'document' || cat === 'documents') {
        filter.mimeType = {
          $in: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain'
          ]
        };
      } else if (cat === 'spreadsheet' || cat === 'spreadsheets') {
        filter.mimeType = {
          $in: [
            'text/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          ]
        };
      }
    }

    const queryOptions: any = { sort: { createdAt: -1 } };
    if (options?.limit) {
      queryOptions.limit = options.limit;
    }
    if (options?.page && options?.limit) {
      queryOptions.skip = (options.page - 1) * options.limit;
    }

    return this.attachmentRepo.findMany(filter, queryOptions);
  }

  public async download(id: string): Promise<{ buffer: Buffer; attachment: AttachmentDocument }> {
    const attachment = await this.attachmentRepo.findById(id);
    if (!attachment) {
      throw new AttachmentDomainError('ATTACHMENT_NOT_FOUND', `Attachment with id "${id}" not found.`, 404);
    }

    const buffer = await this.driveProvider.downloadFile(
      attachment.googleConnectionId,
      attachment.fileId
    );

    if (!buffer || buffer.length === 0) {
      throw new AttachmentDomainError('ATTACHMENT_BINARY_EMPTY', 'Downloaded attachment binary is empty.', 502);
    }

    return { buffer, attachment };
  }

  public async delete(id: string): Promise<void> {
    const attachment = await this.attachmentRepo.findById(id);
    if (!attachment) return;

    try {
      await this.driveProvider.deleteFile(attachment.googleConnectionId, attachment.fileId);
    } catch {
      // Ignore Drive deletion error if file is already gone
    }

    await this.attachmentRepo.delete(id);
  }
}
