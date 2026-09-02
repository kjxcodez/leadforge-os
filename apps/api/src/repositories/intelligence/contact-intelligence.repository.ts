import { BaseRepository } from '../base/base.repository.js';
import { ContactIntelligenceModel, type ContactIntelligenceDocument } from '../../db/models/contact-intelligence.model.js';

export class ContactIntelligenceRepository extends BaseRepository<ContactIntelligenceDocument> {
  constructor(workspaceId?: string) {
    super(ContactIntelligenceModel, workspaceId);
  }

  public async findByContactId(contactId: string): Promise<ContactIntelligenceDocument | null> {
    return this.findOne({ contactId });
  }

  public async upsertByContactId(data: any): Promise<ContactIntelligenceDocument> {
    const { contactId, ...rest } = data;
    const filter = this.workspaceId ? { workspaceId: this.workspaceId, contactId } : { contactId };
    return this.model.findOneAndUpdate(
      filter,
      { $set: { ...rest, updatedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ) as unknown as ContactIntelligenceDocument;
  }
}
