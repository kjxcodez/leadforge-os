import { ContactRepository } from '../../repositories/contact/contact.repository.js';
import type { ContactDocument } from '../../db/models/contact.model.js';
import {
  createContactDtoSchema,
  updateContactDtoSchema,
  type CreateContactDto,
  type UpdateContactDto
} from '@leadforge/schema';

export class ContactService {
  private contactRepository: ContactRepository;

  constructor(workspaceId: string) {
    this.contactRepository = new ContactRepository(workspaceId);
  }

  public async getContactById(id: string): Promise<ContactDocument> {
    return this.contactRepository.findById(id);
  }

  public async listContacts(
    page?: number,
    limit?: number
  ): Promise<{ data: ContactDocument[]; total: number }> {
    return this.contactRepository.paginate({}, page, limit);
  }

  public async createContact(dto: CreateContactDto): Promise<ContactDocument> {
    const validated = createContactDtoSchema.parse(dto);
    return this.contactRepository.create(validated);
  }

  public async updateContact(id: string, dto: UpdateContactDto): Promise<ContactDocument> {
    const validated = updateContactDtoSchema.parse(dto);
    return this.contactRepository.update(id, validated);
  }

  public async deleteContact(id: string): Promise<boolean> {
    return this.contactRepository.delete(id);
  }
}
