import { BaseRepository } from '../base/base.repository.js';
import { CompanyModel, type CompanyDocument } from '../../db/models/company.model.js';

export class CompanyRepository extends BaseRepository<CompanyDocument> {
  constructor(workspaceId?: string) {
    super(CompanyModel, workspaceId);
  }

  public async findByDomain(domain: string): Promise<CompanyDocument | null> {
    return this.findOne({ domain: domain.toLowerCase().trim() });
  }
}
