import { BaseRepository } from '../base/base.repository.js';
import { OutreachModel, type OutreachDocument } from '../../db/models/outreach.model.js';

export class OutreachRepository extends BaseRepository<OutreachDocument> {
  constructor(workspaceId?: string) {
    super(OutreachModel, workspaceId);
  }

  public async findByContactId(contactId: string): Promise<OutreachDocument[]> {
    return this.findMany({ contactId });
  }

  public async findPendingOutreach(): Promise<OutreachDocument[]> {
    return this.findMany({ status: 'pending' });
  }
}
