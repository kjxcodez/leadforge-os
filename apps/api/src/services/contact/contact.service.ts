import { ContactRepository } from "../../repositories/contact/contact.repository.js";
import type { ContactDocument } from "../../db/models/contact.model.js";
import { ContactStatus } from "@leadforge/schema";

export class ContactService {
  private contactRepository: ContactRepository;

  constructor(workspaceId: string) {
    this.contactRepository = new ContactRepository(workspaceId);
  }

  public async getContactById(id: string): Promise<ContactDocument> {
    return this.contactRepository.findById(id);
  }

  public async listContacts(page?: number, limit?: number): Promise<{ data: ContactDocument[]; total: number }> {
    return this.contactRepository.paginate({}, page, limit);
  }

  public async createContact(data: { firstName: string; lastName?: string | null; email?: string | null; phone: string; title?: string | null; linkedinUrl?: string | null; companyId?: string | null }): Promise<ContactDocument> {
    return this.contactRepository.create({
      ...data,
      status: ContactStatus.NEW,
    });
  }

  public async updateContact(id: string, data: Partial<ContactDocument>): Promise<ContactDocument> {
    return this.contactRepository.update(id, data);
  }

  public async deleteContact(id: string): Promise<boolean> {
    return this.contactRepository.delete(id);
  }
}
