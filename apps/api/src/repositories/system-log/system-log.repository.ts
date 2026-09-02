import { BaseRepository } from '../base/base.repository.js';
import { SystemLogModel, type SystemLogDocument } from '../../db/models/system-log.model.js';

export class SystemLogRepository extends BaseRepository<SystemLogDocument> {
  constructor(workspaceId?: string) {
    super(SystemLogModel, workspaceId);
  }

  public async listRecent(limit = 100, severity?: string): Promise<SystemLogDocument[]> {
    const filter: any = {};
    if (severity) filter.severity = severity;
    return this.findMany(filter, { sort: { createdAt: -1 }, limit });
  }
}
