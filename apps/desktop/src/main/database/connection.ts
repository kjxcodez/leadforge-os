import Database from 'better-sqlite3';
import { join } from 'path';
import { app } from 'electron';
import fs from 'fs';

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

/**
 * Initializes and returns the local SQLite database connection.
 * Configures WAL mode, normal synchronisation, and a busy timeout.
 * Supporting workspace isolation by passing a workspaceId.
 */
export function getDatabase(workspaceId?: string): Database.Database {
  if (workspaceId) {
    let db = workspaceDbs.get(workspaceId);
    if (db) return db;

    const userDataPath = app.getPath('userData');
    const workspacesPath = join(userDataPath, 'workspaces');

    if (!fs.existsSync(workspacesPath)) {
      fs.mkdirSync(workspacesPath, { recursive: true });
    }

    const dbPath = join(workspacesPath, `leadforge_${workspaceId}.db`);
    db = new Database(dbPath);

    // Enable Write-Ahead Logging (WAL) for high concurrency
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('busy_timeout = 5000');
    db.pragma('foreign_keys = ON');

    workspaceDbs.set(workspaceId, db);
    logSQLite(`Workspace database initialized at: ${dbPath}`, workspaceId);
    return db;
  }

  // Fallback to legacy global connection
  if (globalDb) return globalDb;

  const userDataPath = app.getPath('userData');
  const dbPath = join(userDataPath, 'leadforge.db');

  globalDb = new Database(dbPath);
  globalDb.pragma('journal_mode = WAL');
  globalDb.pragma('synchronous = NORMAL');
  globalDb.pragma('busy_timeout = 5000');
  globalDb.pragma('foreign_keys = ON');

  logSQLite(`Global database initialized at: ${dbPath}`);
  return globalDb;
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
