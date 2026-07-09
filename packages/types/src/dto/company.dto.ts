import type { CompanyStatus } from '../entities/company';
import type { PaginationParams } from '../api/pagination';

export interface CreateCompanyDto {
  name: string;
  domain?: string | null;
  industry?: string | null;
  size?: string | null;
  location?: string | null;
  status?: CompanyStatus;
}

export interface UpdateCompanyDto extends Partial<CreateCompanyDto> {}

export interface CompanyFilters extends PaginationParams {
  name?: string;
  domain?: string;
  status?: CompanyStatus;
  industry?: string;
}

export interface CompanyListResponse {
  items: import('../entities/company').Company[];
  total: number;
}
