import { getDatabase } from '../connection';

/**
 * LocalCRMRepository implements SQLite CRUD caching operations for workspace-scoped entities
 * (e.g. companies, contacts, campaigns) using dynamically compiled prepared statements.
 */
export const LocalCRMRepository = {
  /**
   * Finds records in a table, strictly isolated by workspaceId and optional column filters.
   */
  async findMany(tableName: string, workspaceId: string, filter?: Record<string, any>): Promise<any[]> {
    const db = getDatabase(workspaceId);
    
    // Ensure table name contains safe alphanumeric chars to prevent SQL injection
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      throw new Error(`Invalid table name: ${tableName}`);
    }

    let query = `SELECT * FROM ${tableName} WHERE workspaceId = ? AND deletedAt IS NULL`;
    const params: any[] = [workspaceId];

    if (filter) {
      for (const [key, value] of Object.entries(filter)) {
        if (value !== undefined && /^[a-zA-Z0-9_]+$/.test(key)) {
          query += ` AND ${key} = ?`;
          params.push(value);
        }
      }
    }

    return db.prepare(query).all(...params);
  },

  /**
   * Finds a single record by ID.
   */
  async findById(tableName: string, workspaceId: string, id: string): Promise<any | null> {
    const db = getDatabase(workspaceId);
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) throw new Error(`Invalid table: ${tableName}`);

    const row = db.prepare(`SELECT * FROM ${tableName} WHERE id = ? AND deletedAt IS NULL`).get(id);
    return row || null;
  },

  /**
   * Inserts or replaces a record.
   */
  async save(tableName: string, record: any): Promise<any> {
    const workspaceId = record.workspaceId;
    if (!workspaceId) throw new Error('workspaceId is required for SQLite crm repository writes.');
    const db = getDatabase(workspaceId);
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) throw new Error(`Invalid table: ${tableName}`);

    const columns = Object.keys(record).filter(col => /^[a-zA-Z0-9_]+$/.test(col));
    const placeholders = columns.map(() => '?').join(', ');
    const query = `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
    
    const params = columns.map((col) => {
      const val = record[col];
      if (val instanceof Date) return val.toISOString();
      if (typeof val === 'object' && val !== null) return JSON.stringify(val);
      return val;
    });

    const runSaveTx = db.transaction(() => {
      // 1. Check if record already exists to determine CREATE vs UPDATE operation
      const existing = db.prepare(`SELECT 1 FROM ${tableName} WHERE id = ?`).get(record.id);
      const operation = existing ? 'UPDATE' : 'CREATE';

      // 2. Perform write on target table
      db.prepare(query).run(...params);

      // 3. Queue offline mutation task if this is a syncable crm table
      const syncableTables = ['companies', 'contacts', 'campaigns'];
      if (syncableTables.includes(tableName)) {
        db.prepare(`
          INSERT INTO sync_queue (id, workspaceId, entityType, entityId, operation, payload, version, retryCount, lastError, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(
          globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : require('crypto').randomUUID(),
          workspaceId,
          tableName,
          record.id,
          operation,
          JSON.stringify(record),
          record.version || 1
        );
      }
    });

    runSaveTx();
    return record;
  },

  /**
   * Bulk inserts or replaces records inside a transaction.
   */
  async saveMany(tableName: string, records: any[]): Promise<void> {
    if (!records.length) return;
    const workspaceId = records[0].workspaceId;
    if (!workspaceId) throw new Error('workspaceId is required for SQLite crm repository writes.');
    const db = getDatabase(workspaceId);
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) throw new Error(`Invalid table: ${tableName}`);

    const columns = Object.keys(records[0]).filter(col => /^[a-zA-Z0-9_]+$/.test(col));
    const placeholders = columns.map(() => '?').join(', ');
    const query = `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
    
    const statement = db.prepare(query);
    const checkStmt = db.prepare(`SELECT 1 FROM ${tableName} WHERE id = ?`);
    const insertSyncQueue = db.prepare(`
      INSERT INTO sync_queue (id, workspaceId, entityType, entityId, operation, payload, version, retryCount, lastError, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const syncableTables = ['companies', 'contacts', 'campaigns'];

    const transaction = db.transaction((list: any[]) => {
      for (const item of list) {
        const params = columns.map((col) => {
          const val = item[col];
          if (val instanceof Date) return val.toISOString();
          if (typeof val === 'object' && val !== null) return JSON.stringify(val);
          return val;
        });

        const existing = checkStmt.get(item.id);
        const operation = existing ? 'UPDATE' : 'CREATE';

        statement.run(...params);

        if (syncableTables.includes(tableName)) {
          insertSyncQueue.run(
            globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : require('crypto').randomUUID(),
            workspaceId,
            tableName,
            item.id,
            operation,
            JSON.stringify(item),
            item.version || 1
          );
        }
      }
    });

    transaction(records);
  },

  /**
   * Sets deletedAt and updates syncStatus to pending to schedule synchronization.
   */
  async softDelete(tableName: string, workspaceId: string, id: string): Promise<void> {
    const db = getDatabase(workspaceId);
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) throw new Error(`Invalid table: ${tableName}`);

    const syncableTables = ['companies', 'contacts', 'campaigns'];

    const transaction = db.transaction(() => {
      // 1. Mark soft delete locally
      db.prepare(`UPDATE ${tableName} SET deletedAt = ?, syncStatus = ? WHERE id = ?`).run(
        new Date().toISOString(),
        'pending',
        id
      );

      // 2. Queue sync operation
      if (syncableTables.includes(tableName)) {
        db.prepare(`
          INSERT INTO sync_queue (id, workspaceId, entityType, entityId, operation, payload, version, retryCount, lastError, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(
          globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : require('crypto').randomUUID(),
          workspaceId,
          tableName,
          id,
          'DELETE',
          null,
          1
        );
      }
    });

    transaction();
  },

  /**
   * Hard deletes a record from local cache.
   */
  async hardDelete(tableName: string, workspaceId: string, id: string): Promise<void> {
    const db = getDatabase(workspaceId);
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) throw new Error(`Invalid table: ${tableName}`);

    db.prepare(`DELETE FROM ${tableName} WHERE id = ?`).run(id);
  },
};

