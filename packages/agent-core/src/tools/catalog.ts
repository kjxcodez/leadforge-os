import type { RiskLevel } from './risk';

export interface ToolCatalogEntry {
  readonly identity: string;
  readonly displayName: string;
  readonly description: string;
  readonly categories: string[];
  readonly tags: string[];
  readonly requiredCapabilities: string[];
  readonly requiredPermissions: string[];
  readonly riskLevel: RiskLevel;
  readonly estimatedDuration: number; // in milliseconds
  readonly supportsCancellation: boolean;
  readonly supportsStreaming: boolean;
  readonly requiresBrowser: boolean;
  readonly requiresNetwork: boolean;
  readonly requiresHumanApproval: boolean;
  readonly sideEffects: string;
  readonly version: string;
}

export class ToolCatalog {
  private readonly entries = new Map<string, ToolCatalogEntry>();

  constructor(initialEntries: ToolCatalogEntry[] = []) {
    for (const entry of initialEntries) {
      this.entries.set(entry.identity, entry);
    }
  }

  public get(identity: string): ToolCatalogEntry | null {
    return this.entries.get(identity) ?? null;
  }

  public list(): ToolCatalogEntry[] {
    return Array.from(this.entries.values());
  }

  public searchByTag(tag: string): ToolCatalogEntry[] {
    const t = tag.toLowerCase();
    return this.list().filter((e) => e.tags.some((x) => x.toLowerCase() === t));
  }

  public searchByCategory(category: string): ToolCatalogEntry[] {
    const c = category.toLowerCase();
    return this.list().filter((e) => e.categories.some((x) => x.toLowerCase() === c));
  }

  public searchByRisk(risk: RiskLevel): ToolCatalogEntry[] {
    return this.list().filter((e) => e.riskLevel === risk);
  }

  public searchByCapability(capability: string): ToolCatalogEntry[] {
    const cap = capability.toLowerCase();
    return this.list().filter((e) => e.requiredCapabilities.some((x) => x.toLowerCase() === cap));
  }
}
