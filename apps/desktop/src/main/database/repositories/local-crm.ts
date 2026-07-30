import { getDatabase } from '../connection';

/**
 * Columns that are stored as JSON strings in SQLite (serialized objects/arrays).
 * When reading records from SQLite, these columns are automatically parsed back
 * into their native JS types so consumers never receive raw JSON strings.
 */
const JSON_COLUMNS = new Set([
  'tags', 'notes', 'steps', 'variables', 'logs', 'contactsJson',
  'statisticsJson', 'executionContext', 'metadata'
]);

/**
 * Parses any JSON_COLUMNS fields that arrived from SQLite as strings.
 * All other fields are passed through unchanged.
 */
function parseJsonFields(row: any): any {
  if (!row || typeof row !== 'object') return row;
  const result = { ...row };
  for (const field of JSON_COLUMNS) {
    if (typeof result[field] === 'string') {
      try {
        result[field] = JSON.parse(result[field]);
      } catch {
        // Value is a plain string, not JSON — leave as-is
      }
    }
  }
  return result;
}

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

    const tableInfo = db.pragma(`table_info(${tableName})`) as Array<{ name: string }>;
    const hasDeletedAt = tableInfo.some(col => col.name === 'deletedAt');

    let query = `SELECT * FROM ${tableName} WHERE workspaceId = ?`;
    if (hasDeletedAt) {
      query += ` AND deletedAt IS NULL`;
    }
    const params: any[] = [workspaceId];

    if (filter) {
      for (const [key, value] of Object.entries(filter)) {
        if (value !== undefined && /^[a-zA-Z0-9_]+$/.test(key)) {
          query += ` AND ${key} = ?`;
          params.push(value);
        }
      }
    }

    return (db.prepare(query).all(...params) as any[]).map(parseJsonFields);
  },

  /**
   * Finds a single record by ID.
   */
  async findById(tableName: string, workspaceId: string, id: string): Promise<any | null> {
    const db = getDatabase(workspaceId);
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) throw new Error(`Invalid table: ${tableName}`);

    const row = db.prepare(`SELECT * FROM ${tableName} WHERE id = ? AND deletedAt IS NULL`).get(id);
    return row ? parseJsonFields(row) : null;
  },

  /**
   * Inserts or replaces a record.
   */
  async save(tableName: string, record: any, skipQueue = false): Promise<any> {
    const workspaceId = record.workspaceId;
    if (!workspaceId) throw new Error('workspaceId is required for SQLite crm repository writes.');
    const db = getDatabase(workspaceId);
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) throw new Error(`Invalid table: ${tableName}`);

    if (record._id && !record.id) {
      record.id = typeof record._id === 'object' ? record._id.toString() : record._id;
    }
    delete record._id;

    if (!record.id) {
      record.id = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : require('crypto').randomUUID();
    }

    // Resolve valid table columns from SQLite schema pragma
    const tableInfo = db.pragma(`table_info(${tableName})`) as Array<{ name: string }>;
    const validColumns = new Set(tableInfo.map(col => col.name));

    const columns = Object.keys(record).filter(col => validColumns.has(col) && /^[a-zA-Z0-9_]+$/.test(col));
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
      const existing = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(record.id) as any;
      const operation = existing ? 'UPDATE' : 'CREATE';

      // 2. Perform write on target table
      db.prepare(query).run(...params);

      // 3. Queue offline mutation task if this is a syncable crm table
      const syncableTables = ['companies', 'contacts', 'campaigns', 'sequences', 'sequence_executions', 'email_accounts', 'templates'];
      if (!skipQueue && syncableTables.includes(tableName)) {
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

      // 4. Audit Trail Logging (Phase 8)
      try {
        const auditLogId = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : require('crypto').randomUUID();
        db.prepare(`
          INSERT INTO audit_logs (id, workspaceId, actor, action, entityId, entityType, beforeValue, afterValue, timestamp)
          VALUES (?, ?, 'user', ?, ?, ?, ?, ?, datetime('now'))
        `).run(
          auditLogId,
          workspaceId,
          `${tableName.toLowerCase()}:${operation.toLowerCase()}`,
          record.id,
          tableName,
          existing ? JSON.stringify(existing) : null,
          JSON.stringify(record)
        );
      } catch (err) {
        // Table not migrated yet
      }
    });

    runSaveTx();
    return record;
  },

  /**
   * Bulk inserts or replaces records inside a transaction.
   */
  async saveMany(tableName: string, records: any[], skipQueue = false): Promise<void> {
    if (!records.length) return;
    const workspaceId = records[0].workspaceId;
    if (!workspaceId) throw new Error('workspaceId is required for SQLite crm repository writes.');
    const db = getDatabase(workspaceId);
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) throw new Error(`Invalid table: ${tableName}`);

    // Map Mongo _id to id and clean records first
    for (const record of records) {
      if (record._id && !record.id) {
        record.id = typeof record._id === 'object' ? record._id.toString() : record._id;
      }
      delete record._id;
    }

    // Resolve valid table columns from SQLite schema pragma
    const tableInfo = db.pragma(`table_info(${tableName})`) as Array<{ name: string }>;
    const validColumns = new Set(tableInfo.map(col => col.name));

    const columns = Object.keys(records[0]).filter(col => validColumns.has(col) && /^[a-zA-Z0-9_]+$/.test(col));
    const placeholders = columns.map(() => '?').join(', ');
    const query = `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
    
    const statement = db.prepare(query);
    const checkStmt = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`);
    const insertSyncQueue = db.prepare(`
      INSERT INTO sync_queue (id, workspaceId, entityType, entityId, operation, payload, version, retryCount, lastError, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const syncableTables = ['companies', 'contacts', 'campaigns', 'sequences', 'sequence_executions', 'email_accounts', 'templates'];

    const transaction = db.transaction((list: any[]) => {
      for (const item of list) {
        const params = columns.map((col) => {
          const val = item[col];
          if (val instanceof Date) return val.toISOString();
          if (typeof val === 'object' && val !== null) return JSON.stringify(val);
          return val;
        });

        const existing = checkStmt.get(item.id) as any;
        const operation = existing ? 'UPDATE' : 'CREATE';

        statement.run(...params);

        if (!skipQueue && syncableTables.includes(tableName)) {
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

        // Audit Trail Logging (Phase 8)
        try {
          const auditLogId = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : require('crypto').randomUUID();
          db.prepare(`
            INSERT INTO audit_logs (id, workspaceId, actor, action, entityId, entityType, beforeValue, afterValue, timestamp)
            VALUES (?, ?, 'user', ?, ?, ?, ?, ?, datetime('now'))
          `).run(
            auditLogId,
            workspaceId,
            `${tableName.toLowerCase()}:${operation.toLowerCase()}`,
            item.id,
            tableName,
            existing ? JSON.stringify(existing) : null,
            JSON.stringify(item)
          );
        } catch (err) {
          // Table not migrated yet
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

    const syncableTables = ['companies', 'contacts', 'campaigns', 'email_accounts', 'templates'];

    const transaction = db.transaction(() => {
      // 1. Mark soft delete locally
      const existing = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id) as any;
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

      // 3. Audit Trail Logging (Phase 8)
      try {
        const auditLogId = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : require('crypto').randomUUID();
        db.prepare(`
          INSERT INTO audit_logs (id, workspaceId, actor, action, entityId, entityType, beforeValue, afterValue, timestamp)
          VALUES (?, ?, 'user', ?, ?, ?, ?, NULL, datetime('now'))
        `).run(
          auditLogId,
          workspaceId,
          `${tableName.toLowerCase()}:delete`,
          id,
          tableName,
          existing ? JSON.stringify(existing) : null
        );
      } catch (err) {
        // Table not migrated yet
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

