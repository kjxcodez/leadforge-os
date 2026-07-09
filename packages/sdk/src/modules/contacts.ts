import { HttpClient } from '../http/client';
import type { Contact, CreateContactDto, UpdateContactDto, ContactFilters } from '@leadforge/types';

export class ContactsModule {
  constructor(private client: HttpClient) {}

  public async list(filters?: ContactFilters): Promise<Contact[]> {
    const queryParams = filters
      ? '?' + new URLSearchParams(filters as any).toString()
      : '';
    return this.client.get<Contact[]>(`/contacts${queryParams}`);
  }

  public async get(id: string): Promise<Contact> {
    return this.client.get<Contact>(`/contacts/${id}`);
  }

  public async create(dto: CreateContactDto): Promise<Contact> {
    return this.client.post<Contact>('/contacts', dto);
  }

  public async update(id: string, dto: UpdateContactDto): Promise<Contact> {
    return this.client.patch<Contact>(`/contacts/${id}`, dto);
  }

  public async delete(id: string): Promise<void> {
    return this.client.delete<void>(`/contacts/${id}`);
  }
}
