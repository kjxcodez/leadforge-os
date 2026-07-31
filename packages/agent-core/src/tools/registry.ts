import type { Tool } from './tool';
import type { RiskLevel } from './risk';

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  /**
   * Registers a new tool in the registry.
   * Throws if the tool name is empty, already exists, or has an invalid schema.
   */
  public register(tool: Tool): void {
    if (!tool) {
      throw new Error('Cannot register undefined or null tool');
    }
    const name = tool.name?.trim();
    if (!name) {
      throw new Error('Tool registration failed: name is required');
    }
    if (this.tools.has(name)) {
      throw new Error(`Tool registration failed: duplicate tool name "${name}"`);
    }
    this.tools.set(name, tool);
  }

  /**
   * Resolves a tool by name. Returns null if not found.
   */
  public get(name: string): Tool | null {
    return this.tools.get(name) ?? null;
  }

  /**
   * Checks if a tool name is registered.
   */
  public has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Lists all registered tools.
   */
  public list(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Lists all tools matching a specific risk level.
   */
  public listByRisk(level: RiskLevel): Tool[] {
    return this.list().filter((t) => t.riskLevel === level);
  }
}
