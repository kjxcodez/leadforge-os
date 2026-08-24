import { HttpClient } from '../http/client.js';
import type {
  Company,
  CreateCompanyDto,
  UpdateCompanyDto,
  CompanyFilters
} from '@leadforge/schema';

export class CompaniesModule {
  constructor(private client: HttpClient) {}

  public async list(filters?: CompanyFilters): Promise<Company[]> {
    const queryParams = filters ? '?' + new URLSearchParams(filters as any).toString() : '';
    return this.client.get<Company[]>(`/companies${queryParams}`);
  }

  public async get(id: string): Promise<Company> {
    return this.client.get<Company>(`/companies/${id}`);
  }

  public async create(dto: CreateCompanyDto): Promise<Company> {
    return this.client.post<Company>('/companies', dto);
  }

  public async update(id: string, dto: UpdateCompanyDto): Promise<Company> {
    return this.client.patch<Company>(`/companies/${id}`, dto);
  }

  public async delete(id: string): Promise<void> {
    return this.client.delete<void>(`/companies/${id}`);
  }
}
