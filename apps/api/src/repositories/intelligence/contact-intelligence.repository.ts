import { BaseRepository } from '../base/base.repository.js';
import { ContactIntelligenceModel, type ContactIntelligenceDocument } from '../../db/models/contact-intelligence.model.js';

export class ContactIntelligenceRepository extends BaseRepository<ContactIntelligenceDocument> {
  constructor(workspaceId?: string) {
    super(ContactIntelligenceModel, workspaceId);
  }

  public async findByContactId(contactId: string): Promise<ContactIntelligenceDocument | null> {
    return this.findOne({ contactId });
  }
}
