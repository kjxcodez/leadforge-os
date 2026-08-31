import { BaseRepository } from '../base/base.repository.js';
import { AttachmentModel, type AttachmentDocument } from '../../db/models/attachment.model.js';

export class AttachmentRepository extends BaseRepository<AttachmentDocument> {
  constructor(workspaceId?: string) {
    super(AttachmentModel, workspaceId);
  }

  public async findByFileId(fileId: string): Promise<AttachmentDocument | null> {
    return this.findOne({ fileId });
  }

  public async findByContentHash(contentHash: string): Promise<AttachmentDocument | null> {
    return this.findOne({ contentHash });
  }

  public async findByConnectionId(googleConnectionId: string): Promise<AttachmentDocument[]> {
    return this.findMany({ googleConnectionId }, { sort: { createdAt: -1 } });
  }
}
