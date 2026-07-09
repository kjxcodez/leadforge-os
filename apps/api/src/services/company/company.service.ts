import { CompanyRepository } from "../../repositories/company/company.repository.js";
import type { CompanyDocument } from "../../db/models/company.model.js";
import { CompanyStatus } from "@leadforge/schema";

export class CompanyService {
  private companyRepository: CompanyRepository;

  constructor(workspaceId: string) {
    this.companyRepository = new CompanyRepository(workspaceId);
  }

  public async getCompanyById(id: string): Promise<CompanyDocument> {
    return this.companyRepository.findById(id);
  }

  public async listCompanies(page?: number, limit?: number): Promise<{ data: CompanyDocument[]; total: number }> {
    return this.companyRepository.paginate({}, page, limit);
  }

  public async createCompany(data: { name: string; domain: string; industry?: string | null; size?: string | null; location?: string | null }): Promise<CompanyDocument> {
    return this.companyRepository.create({
      ...data,
      status: CompanyStatus.LEAD,
      tags: [],
    });
  }

  public async updateCompany(id: string, data: Partial<CompanyDocument>): Promise<CompanyDocument> {
    return this.companyRepository.update(id, data);
  }

  public async deleteCompany(id: string): Promise<boolean> {
    return this.companyRepository.delete(id);
  }
}
