import type { ContactRepository } from '@leadforge/agent-core';
import type { Contact } from '@leadforge/schema';
import { LocalCRMRepository } from './local-crm';

export class ContactRepositoryImpl implements ContactRepository {
  public async getById(id: string, workspaceId: string): Promise<Contact | null> {
    return LocalCRMRepository.findById('contacts', workspaceId, id);
  }

  public async save(contact: Contact): Promise<Contact> {
    return LocalCRMRepository.save('contacts', contact);
  }

  public async findMany(workspaceId: string, filter?: Record<string, any>): Promise<Contact[]> {
    return LocalCRMRepository.findMany('contacts', workspaceId, filter);
  }

  public async delete(id: string, workspaceId: string): Promise<void> {
    await LocalCRMRepository.softDelete('contacts', workspaceId, id);
  }
}
