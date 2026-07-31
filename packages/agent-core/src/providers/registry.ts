import type { ProviderCapabilities } from './capabilities';

export interface ProviderInfo {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
}

export class ProviderRegistry {
  private readonly providers = new Map<string, ProviderInfo>();

  /**
   * Registers a provider and its capability map.
   */
  public register(name: string, capabilities: ProviderCapabilities): void {
    if (!name?.trim()) {
      throw new Error('Provider registration failed: name is required');
    }
    this.providers.set(name, { name, capabilities });
  }

  /**
   * Returns metadata and capabilities of a provider. Returns null if not found.
   */
  public get(name: string): ProviderInfo | null {
    return this.providers.get(name) ?? null;
  }

  /**
   * Checks if a provider name is registered.
   */
  public has(name: string): boolean {
    return this.providers.has(name);
  }

  /**
   * Lists all registered providers.
   */
  public list(): ProviderInfo[] {
    return Array.from(this.providers.values());
  }

  /**
   * Selects all registered providers that satisfy the given capability requirements.
   */
  public selectByCapabilities(requirements: Partial<ProviderCapabilities>): ProviderInfo[] {
    return this.list().filter((p) => {
      for (const [key, value] of Object.entries(requirements)) {
        if (value && !(p.capabilities as any)[key]) {
          return false;
        }
      }
      return true;
    });
  }
}
