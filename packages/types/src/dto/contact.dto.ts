import type { ContactStatus } from '../entities/contact';
import type { PaginationParams } from '../api/pagination';

export interface CreateContactDto {
  companyId?: string | null;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  linkedinUrl?: string | null;
  status?: ContactStatus;
}

export interface UpdateContactDto extends Partial<CreateContactDto> {}

export interface ContactFilters extends PaginationParams {
  companyId?: string;
  email?: string;
  status?: ContactStatus;
}
