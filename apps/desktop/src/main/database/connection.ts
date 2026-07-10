import Database from 'better-sqlite3';
import { join } from 'path';
import { app } from 'electron';

let db: Database.Database | null = null;

/**
 * Initializes and returns the local SQLite database connection.
 * Configures WAL mode, normal synchronisation, and a busy timeout.
 */
export function getDatabase(): Database.Database {
  if (db) return db;

  const userDataPath = app.getPath('userData');
  const dbPath = join(userDataPath, 'leadforge.db');

  db = new Database(dbPath);
  
  // Enable Write-Ahead Logging (WAL) for high concurrency
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');

  console.log(`[SQLite] Local database initialized at: ${dbPath}`);
  return db;
}

/**
 * Closes the active database connection cleanly.
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log('[SQLite] Local database closed cleanly.');
  }
}
