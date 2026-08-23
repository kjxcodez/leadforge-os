import { AudienceRepository } from '../../repositories/audience/audience.repository.js';
import type { AudienceDocument } from '../../db/models/audience.model.js';
import { CompanyModel } from '../../db/models/company.model.js';
import { ContactModel } from '../../db/models/contact.model.js';
import { CompanyDiscoveryRunModel } from '../../db/models/company-discovery-run.model.js';

export class AudienceService {
  private audienceRepository: AudienceRepository;

  constructor(private workspaceId: string) {
    this.audienceRepository = new AudienceRepository(workspaceId);
  }

  public async getAudienceById(id: string): Promise<AudienceDocument> {
    return this.audienceRepository.findById(id);
  }

  public async listAudiences(
    page?: number,
    limit?: number
  ): Promise<{ data: AudienceDocument[]; total: number }> {
    return this.audienceRepository.paginate({}, page, limit);
  }

  public async createAudience(data: Partial<AudienceDocument>): Promise<AudienceDocument> {
    return this.audienceRepository.create(data);
  }

  public async updateAudience(id: string, data: Partial<AudienceDocument>): Promise<AudienceDocument> {
    return this.audienceRepository.update(id, data);
  }

  public async deleteAudience(id: string): Promise<boolean> {
    return this.audienceRepository.delete(id);
  }

  /**
   * Resolves filter definition to matching Contact IDs (or Company IDs).
   */
  public async resolveAudience(audienceId: string): Promise<{ contactIds: string[]; companyIds: string[] }> {
    const audience = await this.getAudienceById(audienceId);
    const filter = audience.filterDefinition || {};

    const companyQuery: any = { workspaceId: this.workspaceId, deletedAt: null };
    const contactQuery: any = { workspaceId: this.workspaceId, deletedAt: null };

    if (filter.search) {
      const searchRegex = new RegExp(filter.search, 'i');
      companyQuery.$or = [{ name: searchRegex }, { domain: searchRegex }, { industry: searchRegex }];
      contactQuery.$or = [{ firstName: searchRegex }, { lastName: searchRegex }, { email: searchRegex }, { title: searchRegex }];
    }

    if (filter.status) {
      companyQuery.status = filter.status;
      contactQuery.status = filter.status;
    }

    if (filter.industry) {
      companyQuery.industry = new RegExp(filter.industry, 'i');
    }

    if (filter.discoveryRunId) {
      const provenances = await CompanyDiscoveryRunModel.find({
        workspaceId: this.workspaceId,
        discoveryRunId: filter.discoveryRunId
      });
      const targetCompanyIds = provenances.map((p) => p.companyId);
      companyQuery._id = { $in: targetCompanyIds };
      contactQuery.companyId = { $in: targetCompanyIds };
    }

    const matchingCompanies = await CompanyModel.find(companyQuery).select('_id');
    const companyIds = matchingCompanies.map((c) => c._id.toString());

    if (companyIds.length > 0 && !contactQuery.companyId) {
      contactQuery.companyId = { $in: companyIds };
    }

    const matchingContacts = await ContactModel.find(contactQuery).select('_id');
    const contactIds = matchingContacts.map((c) => c._id.toString());

    return { contactIds, companyIds };
  }
}
