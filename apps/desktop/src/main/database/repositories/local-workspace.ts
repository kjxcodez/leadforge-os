import { getDatabase } from '../connection';
import type { Workspace } from '@leadforge/schema';

/**
 * LocalWorkspaceRepository handles local SQLite caching of workspace records.
 */
export const LocalWorkspaceRepository = {
  /**
   * Finds a workspace by ID.
   */
  async findById(id: string): Promise<Workspace | null> {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id) as any;
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      ownerId: row.ownerId,
      plan: row.plan || 'free',
      settings: {
        defaultTimezone: row.settingsTimezone || 'UTC'
      },
      members: [], // Members mapping can be lazy-loaded
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    };
  },

  /**
   * Lists all cached workspaces.
   */
  async findMany(): Promise<Workspace[]> {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM workspaces').all() as any[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      ownerId: row.ownerId,
      plan: row.plan || 'free',
      settings: {
        defaultTimezone: row.settingsTimezone || 'UTC'
      },
      members: [],
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    }));
  },

  /**
   * Caches a single workspace.
   */
  async save(ws: Workspace): Promise<Workspace> {
    const db = getDatabase();
    db.prepare(
      `
      INSERT OR REPLACE INTO workspaces (id, name, slug, ownerId, settingsTimezone, syncStatus, version, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      ws.id,
      ws.name,
      ws.slug,
      ws.ownerId,
      ws.settings.defaultTimezone,
      'synced',
      1,
      ws.createdAt ? new Date(ws.createdAt).toISOString() : new Date().toISOString(),
      ws.updatedAt ? new Date(ws.updatedAt).toISOString() : new Date().toISOString()
    );

    return ws;
  },

  /**
   * Caches many workspaces inside a transaction.
   */
  async saveMany(workspaces: Workspace[]): Promise<void> {
    const db = getDatabase();
    const insert = db.prepare(`
      INSERT OR REPLACE INTO workspaces (id, name, slug, ownerId, settingsTimezone, syncStatus, version, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((list: Workspace[]) => {
      for (const ws of list) {
        insert.run(
          ws.id,
          ws.name,
          ws.slug,
          ws.ownerId,
          ws.settings.defaultTimezone,
          'synced',
          1,
          ws.createdAt ? new Date(ws.createdAt).toISOString() : new Date().toISOString(),
          ws.updatedAt ? new Date(ws.updatedAt).toISOString() : new Date().toISOString()
        );
      }
    });

    transaction(workspaces);
  },

  /**
   * Deletes a workspace cache entry.
   */
  async delete(id: string): Promise<void> {
    const db = getDatabase();
    db.prepare('DELETE FROM workspaces WHERE id = ?').run(id);
  }
};
