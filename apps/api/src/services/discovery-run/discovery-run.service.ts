import { DiscoveryRunRepository } from '../../repositories/discovery-run/discovery-run.repository.js';
import { CompanyDiscoveryRunRepository } from '../../repositories/company-discovery-run/company-discovery-run.repository.js';
import { CompanyRepository } from '../../repositories/company/company.repository.js';
import type { DiscoveryRunDocument } from '../../db/models/discovery-run.model.js';
import type { CompanyDiscoveryRunDocument } from '../../db/models/company-discovery-run.model.js';
import type { CompanyDocument } from '../../db/models/company.model.js';

export class DiscoveryRunService {
  private discoveryRunRepository: DiscoveryRunRepository;
  private companyDiscoveryRunRepository: CompanyDiscoveryRunRepository;
  private companyRepository: CompanyRepository;

  constructor(workspaceId: string) {
    this.discoveryRunRepository = new DiscoveryRunRepository(workspaceId);
    this.companyDiscoveryRunRepository = new CompanyDiscoveryRunRepository(workspaceId);
    this.companyRepository = new CompanyRepository(workspaceId);
  }

  public async getRunById(id: string): Promise<DiscoveryRunDocument> {
    return this.discoveryRunRepository.findById(id);
  }

  public async listRuns(
    page?: number,
    limit?: number
  ): Promise<{ data: DiscoveryRunDocument[]; total: number }> {
    return this.discoveryRunRepository.paginate({}, page, limit);
  }

  public async createRun(data: Partial<DiscoveryRunDocument>): Promise<DiscoveryRunDocument> {
    return this.discoveryRunRepository.create(data);
  }

  public async updateRun(id: string, data: Partial<DiscoveryRunDocument>): Promise<DiscoveryRunDocument> {
    return this.discoveryRunRepository.update(id, data);
  }

  public async deleteRun(id: string): Promise<boolean> {
    return this.discoveryRunRepository.delete(id);
  }

  public async recordCompanyProvenance(
    companyId: string,
    discoveryRunId: string,
    requiresReview = false
  ): Promise<any> {
    return this.companyDiscoveryRunRepository.create({
      companyId,
      discoveryRunId,
      requiresReview
    });
  }

  public async listProvenance(
    filter?: any,
    page?: number,
    limit?: number
  ): Promise<{ data: CompanyDiscoveryRunDocument[]; total: number }> {
    return this.companyDiscoveryRunRepository.paginate(filter || {}, page, limit);
  }

  public async listCompaniesForRun(discoveryRunId: string): Promise<string[]> {
    const records = await this.companyDiscoveryRunRepository.findMany({ discoveryRunId });
    return records.map((r) => r.companyId);
  }

  public async getCompaniesForRun(discoveryRunId: string): Promise<CompanyDocument[]> {
    const companyIds = await this.listCompaniesForRun(discoveryRunId);
    if (!companyIds.length) return [];
    return this.companyRepository.findMany({ _id: { $in: companyIds } } as any);
  }
}
