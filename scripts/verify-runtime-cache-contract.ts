import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { initCacheSchema, CACHE_SCHEMA_VERSION } from '../apps/desktop/src/main/database/cache-schema.js';

// -----------------------------------------------------------------------------
// LeadForge OS — Query Contract & Static/Runtime SQLite Cache Auditor
// -----------------------------------------------------------------------------

const VALID_CACHE_TABLES = new Set([
  'workspaces',
  'companies',
  'contacts',
  'campaigns',
  'sequences',
  'sequence_executions',
  'email_accounts',
  'templates',
  'audiences',
  'discovery_runs',
  'company_discovery_runs',
  'settings',
  'cache_metadata'
]);

const FORBIDDEN_TABLE_PATTERNS = [
  /\bFROM\s+sequence_logs\b/i,
  /\bINTO\s+sequence_logs\b/i,
  /\bUPDATE\s+sequence_logs\b/i,
  /\bFROM\s+system_logs\b/i,
  /\bINTO\s+system_logs\b/i,
  /\bUPDATE\s+system_logs\b/i,
  /\bFROM\s+audit_logs\b/i,
  /\bINTO\s+audit_logs\b/i,
  /\bUPDATE\s+audit_logs\b/i,
  /\bFROM\s+jobs\b/i,
  /\bINTO\s+jobs\b/i,
  /\bUPDATE\s+jobs\b/i,
  /\bFROM\s+activities\b/i,
  /\bINTO\s+activities\b/i,
  /\bFROM\s+sync_queue\b/i,
  /\bFROM\s+sync_dead_letter\b/i,
  /\bFROM\s+sync_metadata\b/i,
  /\bsourcePlatform\b/i
];

interface Violation {
  file: string;
  line: number;
  snippet: string;
  rule: string;
}

function scanDirectory(dir: string, violations: Violation[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.git', 'out', 'dist', '.turbo', 'build'].includes(entry.name)) {
        scanDirectory(fullPath, violations);
      }
    } else if (
      entry.isFile() &&
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js'))
    ) {
      if (
        entry.name.includes('.test.') ||
        entry.name.includes('.spec.') ||
        entry.name.startsWith('test-') ||
        fullPath.includes('tests')
      ) {
        continue; // skip test files from production runtime rule
      }
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        for (const pattern of FORBIDDEN_TABLE_PATTERNS) {
          if (pattern.test(line)) {
            violations.push({
              file: path.relative(process.cwd(), fullPath),
              line: idx + 1,
              snippet: line.trim(),
              rule: `Matches forbidden pattern: ${pattern.toString()}`
            });
          }
        }
      });
    }
  }
}

async function run() {
  console.log('========================================================================');
  console.log(' LeadForge OS — Phase 16: Runtime Cache & Query Contract Verification');
  console.log('========================================================================\n');

  // 1. Static Query Scan across production desktop source tree
  console.log('--- [Step 1] Static Codebase SQL Query Scan ---');
  const violations: Violation[] = [];
  scanDirectory(path.resolve('apps/desktop/src'), violations);

  if (violations.length > 0) {
    console.error(`❌ Found ${violations.length} query contract violations in apps/desktop/src:`);
    console.table(violations);
  } else {
    console.log('✅ PASS: Zero forbidden SQL queries or obsolete columns detected in apps/desktop/src.');
  }

  // 2. Runtime Schema Initialization and Dynamic Query Execution Test
  console.log('\n--- [Step 2] Runtime Cache Fixture Verification ---');
  const tempDbPath = path.resolve('report', 'temp-cache-contract-fixture.db');
  if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);

  const db = new Database(tempDbPath);
  initCacheSchema(db);

  // Verify all valid tables exist
  const existingTables = (
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]
  ).map((r) => r.name);

  for (const expectedTable of VALID_CACHE_TABLES) {
    assert.ok(
      existingTables.includes(expectedTable),
      `Expected cache table "${expectedTable}" missing from SQLite schema.`
    );
  }
  console.log(`✅ PASS: All ${VALID_CACHE_TABLES.size} canonical cache tables exist.`);

  // Verify specific critical columns
  const wsCols = (db.prepare('PRAGMA table_info(workspaces)').all() as any[]).map((c) => c.name);
  assert.ok(wsCols.includes('plan'), 'workspaces table must have plan column.');

  const contactCols = (db.prepare('PRAGMA table_info(contacts)').all() as any[]).map((c) => c.name);
  assert.ok(contactCols.includes('source'), 'contacts table must have canonical source column.');
  assert.ok(!contactCols.includes('sourcePlatform'), 'contacts table must not have sourcePlatform.');

  // Test executing representative queries from desktop IPC
  console.log('\n--- [Step 3] Representative Desktop IPC Queries Execution ---');
  db.prepare(`
    INSERT INTO workspaces (id, name, slug, ownerId, plan, settings, createdAt, updatedAt)
    VALUES ('ws-1', 'Acme Corp', 'acme', 'usr-1', 'growth', '{}', datetime('now'), datetime('now'))
  `).run();

  db.prepare(`
    INSERT INTO contacts (id, workspaceId, firstName, lastName, email, source, status, createdAt, updatedAt)
    VALUES ('ct-1', 'ws-1', 'Alice', 'Smith', 'alice@acme.test', 'google_maps', 'verified', datetime('now'), datetime('now'))
  `).run();

  db.prepare(`
    INSERT INTO campaigns (id, workspaceId, name, status, settings, stats, createdAt, updatedAt)
    VALUES ('cmp-1', 'ws-1', 'Alpha Launch', 'ACTIVE', '{}', '{}', datetime('now'), datetime('now'))
  `).run();

  db.prepare(`
    INSERT INTO sequences (id, workspaceId, name, trigger, steps, status, createdAt, updatedAt)
    VALUES ('seq-1', 'ws-1', 'Outreach Flow', '{"type":"manual"}', '[]', 'ACTIVE', datetime('now'), datetime('now'))
  `).run();

  db.prepare(`
    INSERT INTO sequence_executions (id, workspaceId, sequenceId, campaignId, contactId, status, currentStep, logs, createdAt, updatedAt)
    VALUES ('exec-1', 'ws-1', 'seq-1', 'cmp-1', 'ct-1', 'RUNNING', 0, '[]', datetime('now'), datetime('now'))
  `).run();

  // Test representative queries
  const distinctSources = db
    .prepare('SELECT DISTINCT source FROM contacts WHERE workspaceId = ? AND deletedAt IS NULL')
    .all('ws-1');
  assert.ok(distinctSources.length === 1);

  const activeExecs = db
    .prepare("SELECT * FROM sequence_executions WHERE workspaceId = ? AND UPPER(status) = 'RUNNING'")
    .all('ws-1');
  assert.ok(activeExecs.length === 1);

  console.log('✅ PASS: Representative production IPC queries executed cleanly with zero SqliteErrors.');

  db.close();
  if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);

  if (violations.length > 0) {
    process.exit(1);
  }

  console.log('\n========================================================================');
  console.log(' ALL QUERY & RUNTIME CACHE CONTRACT CHECKS PASSED');
  console.log('========================================================================');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Cache contract verification failed:', err);
  process.exit(1);
});
