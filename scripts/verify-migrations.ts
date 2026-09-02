import Database from 'better-sqlite3';
import { initCacheSchema } from '../apps/desktop/src/main/database/cache-schema';

console.log('[Test] Starting database cache schema validation...');
try {
  // Run on isolated in-memory SQLite database
  const db = new Database(':memory:');
  initCacheSchema(db);
  console.log('[Test] Database cache schema verification successfully completed with 0 errors! 🎉');
  process.exit(0);
} catch (err: any) {
  console.error('[Test] Database cache schema verification failed:', err.message || err);
  process.exit(1);
}
