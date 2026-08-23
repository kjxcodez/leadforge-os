import { DiscoveryRunRepository } from '../../repositories/discovery-run/discovery-run.repository.js';
import { CompanyDiscoveryRunRepository } from '../../repositories/company-discovery-run/company-discovery-run.repository.js';
import type { DiscoveryRunDocument } from '../../db/models/discovery-run.model.js';

export class DiscoveryRunService {
  private discoveryRunRepository: DiscoveryRunRepository;
  private companyDiscoveryRunRepository: CompanyDiscoveryRunRepository;

  constructor(workspaceId: string) {
    this.discoveryRunRepository = new DiscoveryRunRepository(workspaceId);
    this.companyDiscoveryRunRepository = new CompanyDiscoveryRunRepository(workspaceId);
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

  public async listCompaniesForRun(discoveryRunId: string): Promise<string[]> {
    const records = await this.companyDiscoveryRunRepository.findMany({ discoveryRunId });
    return records.map((r) => r.companyId);
  }
}
