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
    const db = getDatabase();
    
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
  async findById(tableName: string, id: string): Promise<any | null> {
    const db = getDatabase();
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) throw new Error(`Invalid table: ${tableName}`);

    const row = db.prepare(`SELECT * FROM ${tableName} WHERE id = ? AND deletedAt IS NULL`).get(id);
    return row || null;
  },

  /**
   * Inserts or replaces a record.
   */
  async save(tableName: string, record: any): Promise<any> {
    const db = getDatabase();
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

    db.prepare(query).run(...params);
    return record;
  },

  /**
   * Bulk inserts or replaces records inside a transaction.
   */
  async saveMany(tableName: string, records: any[]): Promise<void> {
    if (!records.length) return;
    const db = getDatabase();
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) throw new Error(`Invalid table: ${tableName}`);

    const columns = Object.keys(records[0]).filter(col => /^[a-zA-Z0-9_]+$/.test(col));
    const placeholders = columns.map(() => '?').join(', ');
    const query = `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
    
    const statement = db.prepare(query);
    const transaction = db.transaction((list: any[]) => {
      for (const item of list) {
        const params = columns.map((col) => {
          const val = item[col];
          if (val instanceof Date) return val.toISOString();
          if (typeof val === 'object' && val !== null) return JSON.stringify(val);
          return val;
        });
        statement.run(...params);
      }
    });

    transaction(records);
  },

  /**
   * Sets deletedAt and updates syncStatus to pending to schedule synchronization.
   */
  async softDelete(tableName: string, id: string): Promise<void> {
    const db = getDatabase();
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) throw new Error(`Invalid table: ${tableName}`);

    db.prepare(`UPDATE ${tableName} SET deletedAt = ?, syncStatus = ? WHERE id = ?`).run(
      new Date().toISOString(),
      'pending',
      id
    );
  },

  /**
   * Hard deletes a record from local cache.
   */
  async hardDelete(tableName: string, id: string): Promise<void> {
    const db = getDatabase();
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) throw new Error(`Invalid table: ${tableName}`);

    db.prepare(`DELETE FROM ${tableName} WHERE id = ?`).run(id);
  },
};
