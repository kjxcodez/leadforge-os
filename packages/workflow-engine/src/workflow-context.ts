/**
 * WorkflowContext is a typed, mutable key-value accumulator that carries
 * inter-step state through a workflow execution. Each step reads its
 * dependencies from context by key and writes its output back under its
 * own step ID.
 *
 * The context is scoped to a single workflow run and discarded after completion.
 */
export class WorkflowContext {
  private readonly store = new Map<string, unknown>();

  /**
   * Seeds the context with initial values before the first step runs.
   */
  constructor(initial: Record<string, unknown> = {}) {
    for (const [key, value] of Object.entries(initial)) {
      this.store.set(key, value);
    }
  }

  /**
   * Retrieves a value from the context by key.
   * Returns undefined if the key is not present.
   */
  public get(key: string): unknown {
    return this.store.get(key);
  }

  /**
   * Stores a value in the context under the given key.
   * Later steps can read it via get(key).
   */
  public set(key: string, value: unknown): void {
    this.store.set(key, value);
  }

  /**
   * Returns a snapshot of all context entries as a plain object.
   * Primarily useful for debugging and serialisation.
   */
  public getAll(): Record<string, unknown> {
    return Object.fromEntries(this.store.entries());
  }

  /**
   * Returns true if the key is present in the context.
   */
  public has(key: string): boolean {
    return this.store.has(key);
  }
}
