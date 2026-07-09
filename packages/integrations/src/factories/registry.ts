import type { BaseAdapter } from '../common/adapter';
import { StubScraperAdapter } from '../adapters/scraper';
import { StubVerificationAdapter } from '../adapters/verification';
import { StubEmailAdapter } from '../adapters/email';

export class IntegrationRegistry {
  private adapters: Map<string, BaseAdapter> = new Map();

  constructor() {
    this.register(new StubScraperAdapter());
    this.register(new StubVerificationAdapter());
    this.register(new StubEmailAdapter());
  }

  public register(adapter: BaseAdapter): void {
    const meta = adapter.getMetadata();
    this.adapters.set(meta.id, adapter);
  }

  public get<T extends BaseAdapter>(id: string): T {
    const adapter = this.adapters.get(id);
    if (!adapter) {
      throw new Error(`Integration adapter with ID '${id}' not found.`);
    }
    return adapter as T;
  }

  public listByType(type: 'scraper' | 'verification' | 'email'): BaseAdapter[] {
    return Array.from(this.adapters.values()).filter((a) => a.getMetadata().type === type);
  }

  public list(): BaseAdapter[] {
    return Array.from(this.adapters.values());
  }
}

export const integrationRegistry = new IntegrationRegistry();
