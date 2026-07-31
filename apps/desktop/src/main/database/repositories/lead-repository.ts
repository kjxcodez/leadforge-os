import type { LeadRepository } from '@leadforge/agent-core';
import type { Contact } from '@leadforge/schema';
import { LocalCRMRepository } from './local-crm';

export class LeadRepositoryImpl implements LeadRepository {
  public async getById(id: string, workspaceId: string): Promise<Contact | null> {
    const contact = await LocalCRMRepository.findById('contacts', workspaceId, id);
    if (contact && contact.status === 'LEAD') {
      return contact;
    }
    return null;
  }

  public async save(lead: Contact): Promise<Contact> {
    const toSave = { ...lead, status: 'LEAD' as const };
    return LocalCRMRepository.save('contacts', toSave);
  }

  public async findMany(workspaceId: string, filter?: Record<string, any>): Promise<Contact[]> {
    const f = { ...filter, status: 'LEAD' as const };
    return LocalCRMRepository.findMany('contacts', workspaceId, f);
  }

  public async delete(id: string, workspaceId: string): Promise<void> {
    await LocalCRMRepository.softDelete('contacts', workspaceId, id);
  }
}
