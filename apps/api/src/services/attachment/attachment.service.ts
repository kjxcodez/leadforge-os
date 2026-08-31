import { createHash } from 'crypto';
import { AttachmentRepository } from '../../repositories/attachment/attachment.repository.js';
import { GoogleConnectionRepository } from '../../repositories/google-connection/google-connection.repository.js';
import { GoogleDriveProvider } from '../google/drive.provider.js';
import { GoogleAuthService } from '../google/auth.service.js';
import type { AttachmentDocument } from '../../db/models/attachment.model.js';

export interface UploadAttachmentOptions {
  googleConnectionId: string;
  filename: string;
  mimeType: string;
  data: Buffer;
  metadata?: Record<string, any> | undefined;
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
      throw new Error('Attachment size exceeds maximum limit of 25 MB.');
    }

    const connection = await this.connectionRepo.findById(options.googleConnectionId);
    if (!connection) {
      throw new Error(`Google connection "${options.googleConnectionId}" not found in this workspace.`);
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
      contentHash,
      metadata: options.metadata || {}
    } as any);

    return attachment;
  }

  public async get(id: string): Promise<AttachmentDocument | null> {
    return this.attachmentRepo.findById(id);
  }

  public async list(): Promise<AttachmentDocument[]> {
    return this.attachmentRepo.findMany({}, { sort: { createdAt: -1 } });
  }

  public async download(id: string): Promise<{ buffer: Buffer; attachment: AttachmentDocument }> {
    const attachment = await this.attachmentRepo.findById(id);
    if (!attachment) {
      throw new Error(`Attachment with id "${id}" not found.`);
    }

    const buffer = await this.driveProvider.downloadFile(
      attachment.googleConnectionId,
      attachment.fileId
    );

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
