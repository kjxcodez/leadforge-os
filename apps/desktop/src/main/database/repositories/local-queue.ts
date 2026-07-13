import { getDatabase } from '../connection';

export interface QueueItem {
  id: string;
  workspaceId: string;
  entityType: string;
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: string; // JSON string
  version: number;
  retryCount: number;
  lastError?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * LocalQueueRepository manages the offline mutation task list inside SQLite.
 */
export const LocalQueueRepository = {
  /**
   * Pushes a new operation onto the sync queue.
   */
  async push(item: Omit<QueueItem, 'retryCount'>): Promise<void> {
    const db = getDatabase(item.workspaceId);
    db.prepare(`
      INSERT INTO sync_queue (id, workspaceId, entityType, entityId, operation, payload, version, retryCount, lastError, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)
    `).run(
      item.id,
      item.workspaceId,
      item.entityType,
      item.entityId,
      item.operation,
      item.payload,
      item.version || 1,
      new Date().toISOString(),
      new Date().toISOString()
    );
  },

  /**
   * Pops the oldest pending task from the queue.
   */
  async pop(workspaceId: string): Promise<QueueItem | null> {
    const db = getDatabase(workspaceId);
    const row = db.prepare(`
      SELECT * FROM sync_queue
      WHERE workspaceId = ? AND retryCount < 5
      ORDER BY createdAt ASC
      LIMIT 1
    `).get(workspaceId) as any;

    if (!row) return null;
    return row as QueueItem;
  },

  /**
   * Lists all pending tasks inside a workspace.
   */
  async list(workspaceId: string): Promise<QueueItem[]> {
    const db = getDatabase(workspaceId);
    const rows = db.prepare(`
      SELECT * FROM sync_queue
      WHERE workspaceId = ?
      ORDER BY createdAt ASC
    `).all(workspaceId) as any[];

    return rows as QueueItem[];
  },

  /**
   * Updates error logs and retry attempts for a failed push task.
   */
  async updateProgress(workspaceId: string, id: string, retryCount: number, error: string): Promise<void> {
    const db = getDatabase(workspaceId);
    db.prepare(`
      UPDATE sync_queue
      SET retryCount = ?, lastError = ?, updatedAt = ?
      WHERE id = ?
    `).run(retryCount, error, new Date().toISOString(), id);
  },

  /**
   * Removes a successfully processed task from the queue.
   */
  async remove(workspaceId: string, id: string): Promise<void> {
    const db = getDatabase(workspaceId);
    db.prepare('DELETE FROM sync_queue WHERE id = ?').run(id);
  },
};

