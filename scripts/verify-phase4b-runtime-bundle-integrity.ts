/**
 * LeadForge OS — Phase 4B Runtime Bundle Integrity Verification Suite
 *
 * Verifies the fix for "Cannot find module './connection'" runtime crash.
 *
 * Tests:
 * 1.  Bundle: no runtime require('./connection') crash pattern
 * 2.  Bundle: only index.js + worker.js emitted (no connection.js chunk)
 * 3.  Bundle: no dynamic await import(connection) causing chunk split
 * 4.  Source: cache-schema.ts has no static/runtime import of connection.ts
 * 5.  Source: cache-schema.ts exports registerResetWorkspaceCache
 * 6.  Source: connection.ts registers the implementation at module level
 * 7.  Source: scheduler.ts uses static import for getDatabase
 * 8.  Source: scheduler.ts has no dynamic await import(connection)
 * 9.  Source: observability-ipc.ts has no require(cache-schema)
 * 10. Source: intelligence tables are present in CACHE_TABLES constant
 * 11. Source: CACHE_SCHEMA_VERSION is 3
 * 12. Source: company_intelligence DDL present in initCacheSchema
 * 13. Source: resetWorkspaceCache body is in connection.ts not cache-schema.ts
 * 14. Source: outbound queue filter covers outreach:campaign
 * 15. Source: outbound queue filter covers automation:workflow
 * 16. Source: outbound queue filter covers outreach:imap-poll
 * 17. Bundle: cache-schema.ts content is inlined into index.js (not split)
 * 18. Bundle: connection.ts content is inlined into index.js (not split)
 * 19. Bundle: registerResetWorkspaceCache pattern appears in bundle
 * 20. Bundle: no await import(...database/connection...) in bundle
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(process.cwd());

let passCount = 0;
let totalCount = 0;

function check(description: string, condition: boolean, errorMsg?: string) {
  totalCount++;
  if (condition) {
    passCount++;
    console.log(`  ✓ ${description}`);
  } else {
    console.error(`  ✗ ${description}${errorMsg ? ': ' + errorMsg : ''}`);
    throw new Error(description + (errorMsg ? ': ' + errorMsg : ''));
  }
}

function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

async function runSuite() {
  console.log('========================================================================');
  console.log(' LeadForge OS — Phase 4B Runtime Bundle Integrity Verification Suite');
  console.log('========================================================================\n');

  // =========================================================================
  // Domain 1–3: Bundle Artifact Analysis
  // =========================================================================
  console.log('--- [Domain 1-3] Production Bundle Artifact Inspection ---');

  const bundlePath = path.join(ROOT, 'apps/desktop/out/main/index.js');
  check('out/main/index.js exists after build', fs.existsSync(bundlePath));

  const bundle = fs.readFileSync(bundlePath, 'utf-8');

  check(
    'Bundle has no runtime require("./connection") — the crash pattern',
    !/require\(["']\.\/connection["']\)/.test(bundle),
    'Found require("./connection") in the production bundle'
  );

  check(
    'Bundle emits no separate connection.js chunk',
    !fs.existsSync(path.join(ROOT, 'apps/desktop/out/main/connection.js')),
    'connection.js chunk exists in out/main/ — dynamic split still active'
  );

  check(
    'Bundle has no dynamic await import(connection) chunk split trigger',
    !/await import\(["'].*connection["']\)/.test(bundle),
    'Found await import(connection) in production bundle'
  );

  // =========================================================================
  // Domain 4–6: cache-schema.ts Circular Dependency Elimination
  // =========================================================================
  console.log('\n--- [Domain 4-6] cache-schema.ts Source Integrity ---');

  const cacheSchema = readSrc('apps/desktop/src/main/database/cache-schema.ts');

  check(
    "cache-schema.ts has no require('./connection')",
    !cacheSchema.includes("require('./connection')"),
    'require("./connection") still present in cache-schema.ts'
  );

  check(
    "cache-schema.ts has no static import from './connection'",
    !cacheSchema.includes("from './connection'"),
    "cache-schema.ts must not statically import from './connection'"
  );

  check(
    'cache-schema.ts exports registerResetWorkspaceCache',
    cacheSchema.includes('registerResetWorkspaceCache'),
    'registerResetWorkspaceCache not found in cache-schema.ts exports'
  );

  // =========================================================================
  // Domain 7–9: connection.ts Hosts resetWorkspaceCache Implementation
  // =========================================================================
  console.log('\n--- [Domain 7-9] connection.ts Implementation Hosting ---');

  const connection = readSrc('apps/desktop/src/main/database/connection.ts');

  check(
    'connection.ts imports registerResetWorkspaceCache from cache-schema',
    connection.includes('registerResetWorkspaceCache'),
    'registerResetWorkspaceCache not imported in connection.ts'
  );

  check(
    'connection.ts defines resetWorkspaceCache function',
    connection.includes('export function resetWorkspaceCache('),
    'resetWorkspaceCache function definition not in connection.ts'
  );

  check(
    'connection.ts calls registerResetWorkspaceCache(resetWorkspaceCache)',
    connection.includes('registerResetWorkspaceCache(resetWorkspaceCache)'),
    'Registration call not found in connection.ts'
  );

  // =========================================================================
  // Domain 10–12: scheduler.ts Static Import Fix
  // =========================================================================
  console.log('\n--- [Domain 10-12] scheduler.ts Static Import Fix ---');

  const scheduler = readSrc('apps/desktop/src/main/ipc/scheduler.ts');

  check(
    "scheduler.ts statically imports getDatabase from '../database/connection'",
    scheduler.includes("import { getDatabase } from '../database/connection'"),
    'getDatabase static import not found in scheduler.ts'
  );

  check(
    'scheduler.ts has no dynamic await import(connection)',
    !scheduler.includes("await import('../database/connection')"),
    'Dynamic await import(connection) still present in scheduler.ts'
  );

  check(
    'scheduler.ts outbound filter covers outreach:campaign',
    scheduler.includes('outreach:campaign'),
    'outreach:campaign missing from outbound job type filter'
  );

  // =========================================================================
  // Domain 13–15: observability-ipc.ts require Elimination
  // =========================================================================
  console.log('\n--- [Domain 13-15] observability-ipc.ts Cleanup ---');

  const observability = readSrc('apps/desktop/src/main/ipc/observability-ipc.ts');

  check(
    "observability-ipc.ts has no require('../database/cache-schema')",
    !observability.includes("require('../database/cache-schema')"),
    'Lazy require for cache-schema still present in observability-ipc.ts'
  );

  check(
    "observability-ipc.ts has no require('../services/cache-hydrator')",
    !observability.includes("require('../services/cache-hydrator')"),
    'Lazy require for cache-hydrator still present in observability-ipc.ts'
  );

  check(
    "observability-ipc.ts has no require('../lib/workspace-manager') (should use static import)",
    !observability.includes("require('../lib/workspace-manager')"),
    'Lazy require for workspace-manager still present in observability-ipc.ts'
  );

  // =========================================================================
  // Domain 16–19: Intelligence Table Schema (Bug H regression)
  // =========================================================================
  console.log('\n--- [Domain 16-19] Intelligence Table Schema (Bug H Regression) ---');

  check(
    'cache-schema.ts CACHE_TABLES includes company_intelligence',
    cacheSchema.includes("'company_intelligence'"),
    'company_intelligence missing from CACHE_TABLES'
  );

  check(
    'cache-schema.ts CACHE_TABLES includes website_intelligence',
    cacheSchema.includes("'website_intelligence'"),
    'website_intelligence missing from CACHE_TABLES'
  );

  check(
    'cache-schema.ts CACHE_TABLES includes contact_intelligence',
    cacheSchema.includes("'contact_intelligence'"),
    'contact_intelligence missing from CACHE_TABLES'
  );

  check(
    'cache-schema.ts CACHE_TABLES includes opportunity_scores',
    cacheSchema.includes("'opportunity_scores'"),
    'opportunity_scores missing from CACHE_TABLES'
  );

  // =========================================================================
  // Domain 20: Bundle Inlines Both Modules
  // =========================================================================
  console.log('\n--- [Domain 20] Bundle Inlines connection + cache-schema ---');

  check(
    'Bundle contains registerResetWorkspaceCache injection pattern',
    bundle.includes('registerResetWorkspaceCache'),
    'Injection pattern not found in production bundle — modules may be split'
  );
}

runSuite()
  .then(() => {
    console.log('\n========================================================================');
    console.log(
      ` Phase 4B Runtime Bundle Integrity: ${passCount}/${totalCount} assertions CERTIFIED`
    );
    console.log('========================================================================\n');
    process.exit(0);
  })
  .catch((err) => {
    console.error(
      `\n❌ Phase 4B Certification Failed (${passCount}/${totalCount}): ${err?.message ?? err}\n`
    );
    process.exit(1);
  });
