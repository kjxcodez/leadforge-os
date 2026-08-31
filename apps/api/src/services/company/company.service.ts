import { CompanyRepository } from '../../repositories/company/company.repository.js';
import type { CompanyDocument } from '../../db/models/company.model.js';
import {
  createCompanyDtoSchema,
  updateCompanyDtoSchema,
  bulkCompanyDtoSchema,
  type CreateCompanyDto,
  type UpdateCompanyDto,
  type BulkCompanyDto,
  type BulkOperationResult
} from '@leadforge/schema';

export class CompanyService {
  private companyRepository: CompanyRepository;

  constructor(workspaceId: string) {
    this.companyRepository = new CompanyRepository(workspaceId);
  }

  public async getCompanyById(id: string): Promise<CompanyDocument> {
    return this.companyRepository.findById(id);
  }

  public async listCompanies(
    page?: number,
    limit?: number
  ): Promise<{ data: CompanyDocument[]; total: number }> {
    return this.companyRepository.paginate({}, page, limit);
  }

  public async createCompany(dto: CreateCompanyDto): Promise<CompanyDocument> {
    const validated = createCompanyDtoSchema.parse(dto);
    return this.companyRepository.create({
      ...validated,
      tags: []
    });
  }

  public async createBulk(dto: BulkCompanyDto): Promise<BulkOperationResult<CompanyDocument>> {
    const validated = bulkCompanyDtoSchema.parse(dto);
    return this.companyRepository.bulkInsert(validated.companies);
  }

  public async updateCompany(id: string, dto: UpdateCompanyDto): Promise<CompanyDocument> {
    const validated = updateCompanyDtoSchema.parse(dto);
    return this.companyRepository.update(id, validated);
  }

  public async deleteCompany(id: string): Promise<boolean> {
    return this.companyRepository.delete(id);
  }
}
