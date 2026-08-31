import { BaseRepository } from '../base/base.repository.js';
import { AuditLogModel, type AuditLogDocument } from '../../db/models/audit-log.model.js';

export class AuditLogRepository extends BaseRepository<AuditLogDocument> {
  constructor(workspaceId?: string) {
    super(AuditLogModel, workspaceId);
  }

  public async appendLog(data: Partial<AuditLogDocument>): Promise<AuditLogDocument> {
    return this.create(data);
  }

  public async findByEntity(entityType: string, entityId: string, limit = 50): Promise<AuditLogDocument[]> {
    return this.findMany({ entityType, entityId }, { sort: { timestamp: -1 }, limit });
  }

  public async findByActor(userId: string, limit = 50): Promise<AuditLogDocument[]> {
    return this.findMany({ 'actor.userId': userId }, { sort: { timestamp: -1 }, limit });
  }
}
