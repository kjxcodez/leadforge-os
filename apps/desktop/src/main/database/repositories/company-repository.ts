import type { CompanyRepository } from '@leadforge/agent-core';
import type { Company } from '@leadforge/schema';
import { LocalCRMRepository } from './local-crm';

export class CompanyRepositoryImpl implements CompanyRepository {
  public async getById(id: string, workspaceId: string): Promise<Company | null> {
    return LocalCRMRepository.findById('companies', workspaceId, id);
  }

  public async save(company: Company): Promise<Company> {
    return LocalCRMRepository.save('companies', company);
  }

  public async findMany(workspaceId: string, filter?: Record<string, any>): Promise<Company[]> {
    return LocalCRMRepository.findMany('companies', workspaceId, filter);
  }

  public async delete(id: string, workspaceId: string): Promise<void> {
    await LocalCRMRepository.softDelete('companies', workspaceId, id);
  }
}
