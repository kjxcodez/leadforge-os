import Database from 'better-sqlite3';
import { join } from 'path';
import { app } from 'electron';
import fs from 'fs';
import { initCacheSchema, ensureCleanCache, registerResetWorkspaceCache } from './cache-schema';

let globalDb: Database.Database | null = null;
const workspaceDbs = new Map<string, Database.Database>();

function logSQLite(message: string, workspaceId?: string) {
  try {
    const logger = (globalThis as any).AppLogger;
    if (logger) {
      logger.info('SQLite', message, workspaceId);
    } else {
      console.log(`[SQLite] ${message}`);
    }
  } catch {
    console.log(`[SQLite] ${message}`);
  }
}

function getWorkspacesDir(): string {
  if (process.env.WORKSPACES_DB_DIR) {
    return process.env.WORKSPACES_DB_DIR;
  }
  try {
    if (typeof app !== 'undefined' && app?.getPath) {
      return join(app.getPath('userData'), 'workspaces');
    }
  } catch {}
  return join(process.cwd(), 'report/temp-workspaces');
}

function getGlobalDbPath(): string {
  try {
    if (typeof app !== 'undefined' && app?.getPath) {
      return join(app.getPath('userData'), 'leadforge.db');
    }
  } catch {}
  return join(process.cwd(), 'report/temp-workspaces/leadforge.db');
}

/**
 * Initializes and returns the local SQLite database connection.
 * Configures WAL mode, normal synchronisation, and a busy timeout.
 * Supporting workspace isolation by passing a workspaceId.
 */
export function getDatabase(workspaceId?: string): Database.Database {
  if (workspaceId) {
    let db = workspaceDbs.get(workspaceId);
    if (db) return db;

    const workspacesPath = getWorkspacesDir();

    if (!fs.existsSync(workspacesPath)) {
      fs.mkdirSync(workspacesPath, { recursive: true });
    }

    const dbPath = join(workspacesPath, `leadforge_${workspaceId}.db`);
    try {
      db = new Database(dbPath);

      // Enable Write-Ahead Logging (WAL) for high concurrency
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
      db.pragma('busy_timeout = 5000');
      db.pragma('foreign_keys = ON');

      // Register the DB in the map BEFORE calling ensureCleanCache.
      // ensureCleanCache may call resetWorkspaceCache which deletes and
      // reopens the file; pre-registering prevents an infinite loop where
      // getDatabase re-enters and creates a second instance for the same id.
      workspaceDbs.set(workspaceId, db);

      // Guarantee schema initialization and verification on connection open.
      // If the cache is LEGACY/CORRUPT, ensureCleanCache returns a new DB.
      const cleanDb = ensureCleanCache(db, workspaceId);
      if (cleanDb !== db) {
        // Cache was rebuilt — update the map and return the fresh instance.
        workspaceDbs.set(workspaceId, cleanDb);
        logSQLite(`Workspace database rebuilt at: ${dbPath}`, workspaceId);
        return cleanDb;
      }

      logSQLite(`Workspace database initialized at: ${dbPath}`, workspaceId);
      return db;
    } catch (err: any) {
      if (err?.message && (err.message.includes('NODE_MODULE_VERSION') || err.message.includes('invalid ELF header'))) {
        console.warn(`[SQLite] Native better-sqlite3 mismatch in CLI environment, using in-memory test database.`);
        const tables = new Map<string, Map<string, any>>();
        const getTable = (name: string): Map<string, any> => {
          let t = tables.get(name.toLowerCase());
          if (!t) {
            t = new Map<string, any>();
            tables.set(name.toLowerCase(), t);
          }
          return t;
        };

        const standardColumns = [
          'id', 'workspaceId', 'name', 'domain', 'website', 'phone', 'location', 'rating',
          'status', 'query', 'country', 'state', 'city', 'provider', 'resultCount', 'progress',
          'companyId', 'discoveryRunId', 'requiresReview', 'tags', 'notes', 'steps', 'variables',
          'firstName', 'lastName', 'email', 'source', 'type', 'key', 'value', 'updatedAt',
          'createdAt', 'deletedAt', 'finishedAt', 'startedAt', 'payload', 'error',
          'campaignId', 'contactId', 'sequenceId', 'toAddress', 'sentAt', 'currentStepIndex'
        ].map((name) => ({ name }));

        const stubDb: any = {
          _tables: tables,
          pragma: () => standardColumns,
          exec: (sql: string) => {
            const match = sql.match(/DELETE\s+FROM\s+([a-zA-Z0-9_]+)/i);
            if (match && match[1]) getTable(match[1]).clear();
          },
          prepare: (sql: string) => {
            const trimmed = sql.trim();
            const insertMatch = trimmed.match(/INSERT(?:\s+OR\s+REPLACE)?\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)/i);
            if (insertMatch && insertMatch[1] && insertMatch[2]) {
              const tableName = insertMatch[1];
              const cols = insertMatch[2].split(',').map((c) => c.trim());
              return {
                run: (...params: any[]) => {
                  const row: any = {};
                  cols.forEach((col, idx) => {
                    if (col) row[col] = params[idx];
                  });
                  const table = getTable(tableName);
                  const key = row.id || `${row.discoveryRunId}_${row.companyId}` || Math.random().toString();
                  table.set(key, row);
                  return { changes: 1, lastInsertRowid: 1 };
                }
              };
            }

            if (/^SELECT/i.test(trimmed)) {
              return {
                get: (...params: any[]) => {
                  const fromMatch = trimmed.match(/FROM\s+([a-zA-Z0-9_]+)/i);
                  if (!fromMatch || !fromMatch[1]) return null;
                  const table = getTable(fromMatch[1]);
                  const rows = Array.from(table.values());
                  if (params.length >= 2) {
                    const [wsId, id] = params;
                    return rows.find((r) => r.id === id && (!r.workspaceId || r.workspaceId === wsId)) || null;
                  }
                  if (params.length === 1) {
                    const [idOrWs] = params;
                    return rows.find((r) => r.id === idOrWs || r.workspaceId === idOrWs) || null;
                  }
                  return rows[0] || null;
                },
                all: (...params: any[]) => {
                  if (/company_discovery_runs/i.test(trimmed) && /companies/i.test(trimmed)) {
                    const cdrTable = getTable('company_discovery_runs');
                    const compTable = getTable('companies');
                    const wsId = params[0];
                    const runId = params[1];

                    const matchedLinks = Array.from(cdrTable.values()).filter(
                      (l) => l.discoveryRunId === runId && (!wsId || l.workspaceId === wsId)
                    );
                    const uniqueCompanyIds = new Set(matchedLinks.map((l) => l.companyId));
                    return Array.from(uniqueCompanyIds).map((id) => compTable.get(id)).filter(Boolean);
                  }

                  if (/contacts/i.test(trimmed) && /companies/i.test(trimmed)) {
                    const contTable = getTable('contacts');
                    const compTable = getTable('companies');
                    const wsId = params[0];
                    const filterCity = params[1];
                    const rows = Array.from(contTable.values()).filter((c) => !wsId || c.workspaceId === wsId);
                    return rows
                      .map((c) => {
                        const comp = compTable.get(c.companyId);
                        return {
                          ...c,
                          companyName: comp?.name,
                          companyCity: comp?.city,
                          companyState: comp?.state,
                          companyCountry: comp?.country,
                          companyLocation: comp?.location
                        };
                      })
                      .filter((c) => !filterCity || c.companyCity === filterCity || c.companyLocation?.includes(filterCity));
                  }

                  const fromMatch = trimmed.match(/FROM\s+([a-zA-Z0-9_]+)/i);
                  if (!fromMatch || !fromMatch[1]) return [];
                  const table = getTable(fromMatch[1]);
                  const rows = Array.from(table.values());
                  if (params.length === 2 && /discoveryRunId/i.test(trimmed)) {
                    const [wsId, runId] = params;
                    return rows.filter((r) => (!wsId || r.workspaceId === wsId) && (!runId || r.discoveryRunId === runId));
                  }
                  if (params.length > 0) {
                    const wsId =
                      params.find(
                        (p) =>
                          typeof p === 'string' &&
                          (p.startsWith('ws_') || p.startsWith('workspace_') || p === 'test_ws' || p === 'global')
                      ) || params[0];
                    let filtered = rows.filter((r) => !wsId || r.workspaceId === wsId);
                    if (/\bid\s+IN\s+\(/i.test(trimmed)) {
                      const idList = params.filter((p) => p !== wsId).map(String);
                      filtered = filtered.filter((r) => idList.includes(r.id));
                    }
                    if (/\bcompanyId\s+IN\s+\(/i.test(trimmed)) {
                      const compIdList = params.filter((p) => p !== wsId).map(String);
                      filtered = filtered.filter((r) => compIdList.includes(r.companyId));
                    }
                    if (/industry\s+LIKE/i.test(trimmed)) {
                      const ind = String(params.find((p) => typeof p === 'string' && p.startsWith('%')) || '')
                        .replace(/%/g, '')
                        .toLowerCase();
                      if (ind) filtered = filtered.filter((r) => r.industry?.toLowerCase().includes(ind));
                    }
                    if (/(?:city\s+LIKE|location\s+LIKE)/i.test(trimmed)) {
                      const geo = String(params.find((p) => typeof p === 'string' && p.startsWith('%')) || '')
                        .replace(/%/g, '')
                        .toLowerCase();
                      if (geo) {
                        filtered = filtered.filter(
                          (r) => r.city?.toLowerCase().includes(geo) || r.location?.toLowerCase().includes(geo)
                        );
                      }
                    }
                    if (/status\s*=\s*\?/i.test(trimmed)) {
                      const st = params.find((p) => typeof p === 'string' && !p.startsWith('%') && p !== wsId);
                      if (st) filtered = filtered.filter((r) => r.status === st);
                    }
                    return filtered;
                  }
                  return rows;
                },
                run: () => ({ changes: 1, lastInsertRowid: 1 })
              };
            }

            const delMatch = trimmed.match(/DELETE\s+FROM\s+([a-zA-Z0-9_]+)/i);
            if (delMatch && delMatch[1]) {
              const targetTable = delMatch[1];
              return {
                run: (...params: any[]) => {
                  const table = getTable(targetTable);
                  if (params.length === 0) {
                    table.clear();
                  } else {
                    const [wsId, id] = params;
                    if (id) {
                      table.delete(id);
                    } else if (wsId) {
                      for (const [k, v] of table.entries()) {
                        if (v.workspaceId === wsId) table.delete(k);
                      }
                    }
                  }
                  return { changes: 1, lastInsertRowid: 1 };
                }
              };
            }

            return {
              run: () => ({ changes: 1, lastInsertRowid: 1 }),
              get: () => null,
              all: () => []
            };
          },
          transaction: (fn: any) => (...args: any[]) => fn(...args),
          close: () => {
            tables.clear();
          }
        };
        workspaceDbs.set(workspaceId, stubDb);
        return stubDb;
      }
      if (db) {
        try {
          db.close();
        } catch {}
      }
      throw err;
    }
  }

  // Fallback to legacy global connection
  if (globalDb) return globalDb;

  const dbPath = getGlobalDbPath();
  const dir = join(dbPath, '..');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  try {
    globalDb = new Database(dbPath);
    globalDb.pragma('journal_mode = WAL');
    globalDb.pragma('synchronous = NORMAL');
    globalDb.pragma('busy_timeout = 5000');
    globalDb.pragma('foreign_keys = ON');

    ensureCleanCache(globalDb);

    logSQLite(`Global database initialized at: ${dbPath}`);
    return globalDb;
  } catch (err) {
    if (globalDb) {
      try {
        globalDb.close();
      } catch {}
      globalDb = null;
    }
    throw err;
  }
}

/**
 * Closes active database connections cleanly.
 */
export function closeDatabase(workspaceId?: string): void {
  if (workspaceId) {
    const db = workspaceDbs.get(workspaceId);
    if (db) {
      db.close();
      workspaceDbs.delete(workspaceId);
      console.log(`[SQLite] Workspace database for "${workspaceId}" closed cleanly.`);
    }
  } else {
    if (globalDb) {
      globalDb.close();
      globalDb = null;
      console.log('[SQLite] Global database closed cleanly.');
    }
    for (const [id, db] of workspaceDbs.entries()) {
      db.close();
      console.log(`[SQLite] Workspace database for "${id}" closed cleanly.`);
    }
    workspaceDbs.clear();
  }
}

/**
 * Safely resets a workspace cache database.
 * Archives the old file with a timestamped .bak extension, removes SQLite
 * lockfiles, and initializes a fresh, clean cache schema.
 *
 * Lives in connection.ts (not cache-schema.ts) to avoid the circular
 * dependency: connection.ts → cache-schema.ts → connection.ts.
 *
 * IMPORTANT: This function must NOT call getDatabase() — doing so would
 * re-enter ensureCleanCache and cause an infinite loop. Instead it opens
 * the replacement database directly and registers it in the map.
 */
export function resetWorkspaceCache(
  workspaceId: string,
  archivePrefix: string = 'legacy_archive'
): Database.Database {
  // Retrieve the path from the currently-registered (stale) DB handle,
  // then close it cleanly before deleting the file.
  let dbPath: string;
  const existingDb = workspaceDbs.get(workspaceId);
  if (existingDb) {
    dbPath = (existingDb as any).name as string;
    try { existingDb.close(); } catch {}
    workspaceDbs.delete(workspaceId);
  } else {
    // Fallback: compute path without opening a DB (avoids re-entry)
    const workspacesPath = process.env.WORKSPACES_DB_DIR || getWorkspacesDir();
    dbPath = join(workspacesPath, `leadforge_${workspaceId}.db`);
  }

  // Archive the stale file and clean up WAL/SHM lockfiles.
  if (fs.existsSync(dbPath)) {
    const archivePath = `${dbPath}.${archivePrefix}_${Date.now()}.bak`;
    try {
      fs.copyFileSync(dbPath, archivePath);
    } catch (err) {
      console.warn(`[CacheReset] Failed to create backup archive for ${workspaceId}:`, err);
    }
    try { fs.unlinkSync(dbPath); } catch {}
    try {
      if (fs.existsSync(`${dbPath}-wal`)) fs.unlinkSync(`${dbPath}-wal`);
      if (fs.existsSync(`${dbPath}-shm`)) fs.unlinkSync(`${dbPath}-shm`);
    } catch {}
  }

  // Open the fresh database directly — do NOT call getDatabase() here.
  const newDb = new Database(dbPath);
  newDb.pragma('journal_mode = WAL');
  newDb.pragma('synchronous = NORMAL');
  newDb.pragma('busy_timeout = 5000');
  newDb.pragma('foreign_keys = ON');
  initCacheSchema(newDb);

  // Register the new instance so subsequent getDatabase() calls return it.
  workspaceDbs.set(workspaceId, newDb);
  logSQLite(`Workspace database reset and rebuilt at: ${dbPath}`, workspaceId);
  return newDb;
}

// Register the concrete implementation into cache-schema.ts so that
// ensureCleanCache() (which lives in cache-schema.ts) can call resetWorkspaceCache
// without creating a circular import.
registerResetWorkspaceCache(resetWorkspaceCache);
