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
    limit?: number,
    filter?: any
  ): Promise<{ data: CompanyDocument[]; total: number }> {
    const query: any = {};
    if (filter) {
      if (filter.status) query.status = filter.status;
      if (filter.industry) query.industry = { $regex: filter.industry, $options: 'i' };
      if (filter.city) query.$or = [{ city: { $regex: filter.city, $options: 'i' } }, { location: { $regex: filter.city, $options: 'i' } }];
      if (filter.state) {
        const stateOr = [{ state: { $regex: filter.state, $options: 'i' } }, { location: { $regex: filter.state, $options: 'i' } }];
        if (query.$or) {
          query.$and = (query.$and || []).concat([{ $or: query.$or }, { $or: stateOr }]);
          delete query.$or;
        } else {
          query.$or = stateOr;
        }
      }
      if (filter.country) {
        const countryOr = [{ country: { $regex: filter.country, $options: 'i' } }, { location: { $regex: filter.country, $options: 'i' } }];
        if (query.$and || query.$or) {
          query.$and = (query.$and || []).concat(query.$or ? [{ $or: query.$or }] : []).concat([{ $or: countryOr }]);
          delete query.$or;
        } else {
          query.$or = countryOr;
        }
      }
      if (filter.location && !filter.city && !filter.state && !filter.country) {
        query.location = { $regex: filter.location, $options: 'i' };
      }
      if (filter.name) query.name = { $regex: filter.name, $options: 'i' };
      if (filter.domain) query.domain = { $regex: filter.domain, $options: 'i' };
      if (filter.search) {
        const searchRegex = { $regex: filter.search, $options: 'i' };
        const searchConditions = [
          { name: searchRegex },
          { domain: searchRegex },
          { industry: searchRegex },
          { location: searchRegex }
        ];
        if (query.$and || query.$or) {
          query.$and = (query.$and || []).concat(query.$or ? [{ $or: query.$or }] : []).concat([{ $or: searchConditions }]);
          delete query.$or;
        } else {
          query.$or = searchConditions;
        }
      }
    }
    return this.companyRepository.paginate(query, page, limit, { createdAt: -1 });
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
