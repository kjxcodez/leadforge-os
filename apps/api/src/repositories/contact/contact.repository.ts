import { BaseRepository } from '../base/base.repository.js';
import { ContactModel, type ContactDocument } from '../../db/models/contact.model.js';

export class ContactRepository extends BaseRepository<ContactDocument> {
  constructor(workspaceId?: string) {
    super(ContactModel, workspaceId);
  }

  public async findByEmail(email: string): Promise<ContactDocument | null> {
    return this.findOne({ email: email.toLowerCase().trim() });
  }

  public async findByCompanyId(companyId: string): Promise<ContactDocument[]> {
    return this.findMany({ companyId });
  }
}
