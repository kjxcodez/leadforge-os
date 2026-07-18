import type { JobContext } from '../../shared/types/job';

/**
 * WorkerPluginRegistry
 *
 * An extensible, duplicate-guarded registry that maps job type strings to
 * their plugin executor functions. Replaces the previous static `JobRegistry`
 * plain object with a class that enforces uniqueness and supports runtime
 * introspection.
 *
 * Spec: worker_runtime_spec.md §4.6
 */
export class WorkerPluginRegistry {
  private readonly plugins = new Map<string, (ctx: JobContext) => Promise<any>>();

  /**
   * Register a plugin executor for a given job type.
   *
   * @param type    - The unique job type string (e.g. `'scraper:maps'`).
   * @param fn      - The async executor function that receives a `JobContext`.
   * @throws        - If a plugin for `type` has already been registered.
   */
  register(type: string, fn: (ctx: JobContext) => Promise<any>): void {
    if (this.plugins.has(type)) {
      throw new Error(`Plugin '${type}' already registered`);
    }
    this.plugins.set(type, fn);
  }

  /**
   * Resolve a plugin executor by job type.
   *
   * @param type - The job type string to look up.
   * @returns    The executor function, or `null` if the type is not registered.
   */
  resolve(type: string): ((ctx: JobContext) => Promise<any>) | null {
    return this.plugins.get(type) ?? null;
  }

  /**
   * List all registered job type strings.
   *
   * @returns A new array of every registered type string in insertion order.
   */
  listTypes(): string[] {
    return [...this.plugins.keys()];
  }
}
