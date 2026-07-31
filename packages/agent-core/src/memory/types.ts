export type MemoryScope = 'conversation' | 'workspace' | 'execution' | 'scratchpad' | 'semantic';

export interface MemoryMetadata {
  readonly scope: MemoryScope;
  readonly owner: 'session' | 'workspace' | 'job' | 'planner';
  readonly lifetime: 'session' | 'permanent' | 'job' | 'iteration';
  readonly isShared: boolean;
  readonly persistence: 'db' | 'memory';
}

export interface ChatMessage {
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
  readonly timestamp: string;
  readonly metadata?: Record<string, unknown>;
}

export interface ScopedMemoryStore {
  readonly metadata: MemoryMetadata;
  get(key: string, context: { workspaceId: string }): Promise<unknown>;
  set(key: string, value: unknown, context: { workspaceId: string }): Promise<void>;
  delete(key: string, context: { workspaceId: string }): Promise<void>;
}

export interface ConversationMemory {
  readonly metadata: MemoryMetadata;
  getMessages(sessionId: string, limit?: number): Promise<ChatMessage[]>;
  addMessage(sessionId: string, message: ChatMessage): Promise<void>;
  clear(sessionId: string): Promise<void>;
}
