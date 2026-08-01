import { randomUUID } from 'crypto';
import type { AgentMemoryRepository } from '@leadforge/agent-core';
import { getDatabase } from '../connection';

export class AgentMemoryRepositoryImpl implements AgentMemoryRepository {
  /**
   * Retrieves scoped memory value from workspace_memory table.
   */
  public async getMemory(workspaceId: string, scope: string, key: string): Promise<unknown> {
    const db = getDatabase(workspaceId);
    const row = db
      .prepare(
        `
      SELECT value FROM workspace_memory
      WHERE workspaceId = ? AND scope = ? AND key = ? AND deletedAt IS NULL
    `
      )
      .get(workspaceId, scope, key) as { value: string } | undefined;

    if (row?.value) {
      try {
        return JSON.parse(row.value);
      } catch {
        return row.value;
      }
    }
    return null;
  }

  /**
   * Saves memory and inserts corresponding outbox records into sync_queue (Outbox Pattern).
   */
  public async saveMemory(
    workspaceId: string,
    scope: string,
    key: string,
    value: unknown
  ): Promise<void> {
    const db = getDatabase(workspaceId);
    const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
    const id = randomUUID();

    db.transaction(() => {
      const existing = db
        .prepare(
          `
        SELECT id, version FROM workspace_memory
        WHERE workspaceId = ? AND scope = ? AND key = ? AND deletedAt IS NULL
      `
        )
        .get(workspaceId, scope, key) as { id: string; version: number } | undefined;

      if (existing) {
        db.prepare(
          `
          UPDATE workspace_memory
          SET value = ?, version = version + 1, updatedAt = datetime('now'), syncStatus = 'pending'
          WHERE id = ?
        `
        ).run(serialized, existing.id);

        db.prepare(
          `
          INSERT INTO sync_queue (id, workspaceId, entityType, entityId, operation, payload, version)
          VALUES (?, ?, 'workspace_memory', ?, 'UPDATE', ?, ?)
        `
        ).run(randomUUID(), workspaceId, existing.id, serialized, existing.version + 1);
      } else {
        db.prepare(
          `
          INSERT INTO workspace_memory (id, workspaceId, scope, key, value, syncStatus, version)
          VALUES (?, ?, ?, ?, ?, 'pending', 1)
        `
        ).run(id, workspaceId, scope, key, serialized);

        db.prepare(
          `
          INSERT INTO sync_queue (id, workspaceId, entityType, entityId, operation, payload, version)
          VALUES (?, ?, 'workspace_memory', ?, 'CREATE', ?, 1)
        `
        ).run(randomUUID(), workspaceId, id, serialized);
      }
    })();
  }

  /**
   * Soft deletes memory from workspace_memory table and logs outbox DELETE command.
   */
  public async deleteMemory(workspaceId: string, scope: string, key: string): Promise<void> {
    const db = getDatabase(workspaceId);

    db.transaction(() => {
      const existing = db
        .prepare(
          `
        SELECT id FROM workspace_memory
        WHERE workspaceId = ? AND scope = ? AND key = ? AND deletedAt IS NULL
      `
        )
        .get(workspaceId, scope, key) as { id: string } | undefined;

      if (existing) {
        db.prepare(
          `
          UPDATE workspace_memory
          SET deletedAt = datetime('now'), syncStatus = 'pending', updatedAt = datetime('now')
          WHERE id = ?
        `
        ).run(existing.id);

        db.prepare(
          `
          INSERT INTO sync_queue (id, workspaceId, entityType, entityId, operation, payload, version)
          VALUES (?, ?, 'workspace_memory', ?, 'DELETE', NULL, 1)
        `
        ).run(randomUUID(), workspaceId, existing.id);
      }
    })();
  }
}
