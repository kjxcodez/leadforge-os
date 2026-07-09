import type { CreateCompanyDto, CompanyFilters } from '../dto/company.dto';
import type { Company } from '../entities/company';

// Map of channel name -> { input: T, output: U }
export interface IpcChannelMap {
  'companies:list': {
    input: CompanyFilters;
    output: Company[];
  };
  'companies:create': {
    input: CreateCompanyDto;
    output: Company;
  };
  'system:status': {
    input: void;
    output: Array<{ name: string; status: string }>;
  };
  // Add other channels here over time
}
