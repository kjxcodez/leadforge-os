import Database from 'better-sqlite3';
import { runMigrations } from '../apps/desktop/src/main/database/runner';

console.log('[Test] Starting database migrations validation...');
try {
  // Run on isolated in-memory SQLite database
  const db = new Database(':memory:');
  runMigrations(db);
  console.log('[Test] Database migrations verification successfully completed with 0 errors! 🎉');
  process.exit(0);
} catch (err: any) {
  console.error('[Test] Database migrations verification failed:', err.message || err);
  process.exit(1);
}
