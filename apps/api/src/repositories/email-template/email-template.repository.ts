import { BaseRepository } from '../base/base.repository.js';
import { EmailTemplateModel, type EmailTemplateDocument } from '../../db/models/email-template.model.js';

export class EmailTemplateRepository extends BaseRepository<EmailTemplateDocument> {
  constructor(workspaceId?: string) {
    super(EmailTemplateModel, workspaceId);
  }

  public async findByName(name: string): Promise<EmailTemplateDocument | null> {
    return this.findOne({ name });
  }
}
