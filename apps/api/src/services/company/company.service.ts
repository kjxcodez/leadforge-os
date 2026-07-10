import { CompanyRepository } from "../../repositories/company/company.repository.js";
import type { CompanyDocument } from "../../db/models/company.model.js";
import { createCompanyDtoSchema, updateCompanyDtoSchema, type CreateCompanyDto, type UpdateCompanyDto } from "@leadforge/schema";

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

  public async createCompany(dto: CreateCompanyDto): Promise<CompanyDocument> {
    const validated = createCompanyDtoSchema.parse(dto);
    return this.companyRepository.create({
      ...validated,
      tags: [],
    });
  }

  public async updateCompany(id: string, dto: UpdateCompanyDto): Promise<CompanyDocument> {
    const validated = updateCompanyDtoSchema.parse(dto);
    return this.companyRepository.update(id, validated);
  }

  public async deleteCompany(id: string): Promise<boolean> {
    return this.companyRepository.delete(id);
  }
}
