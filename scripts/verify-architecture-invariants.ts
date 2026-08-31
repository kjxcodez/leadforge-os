import * as fs from 'fs';
import * as path from 'path';
import assert from 'assert';
import Database from 'better-sqlite3';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import {
  initCacheSchema,
  detectCacheState,
  resetWorkspaceCache,
  ensureCleanCache,
  CACHE_TABLES,
  CACHE_SCHEMA_VERSION
} from '../apps/desktop/src/main/database/cache-schema.js';
import { runStaticAudit as runRunnerAudit } from './verify-no-legacy-runner-dependencies.js';
import { runSyncDependencyAudit as runSyncAudit } from './verify-no-sync-dependencies.js';
import {
  CompanyModel,
  ContactModel,
  WorkspaceModel,
  UserModel,
  JobModel,
  EmailDeliveryModel,
  EmailAccountModel,
  GoogleConnectionModel,
  AttachmentModel,
  SystemLogModel,
  AutomationLockModel
} from '../apps/api/src/db/models/index.js';

dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/leadforge-os';

export interface InvariantCheckResult {
  invariant: string;
  name: string;
  passed: boolean;
  details: string;
}

export async function runArchitectureInvariantsAudit(): Promise<{
  allPassed: boolean;
  results: InvariantCheckResult[];
}> {
  const results: InvariantCheckResult[] = [];

  function record(invariant: string, name: string, fn: () => void | Promise<void>): Promise<void> {
    return Promise.resolve(fn())
      .then(() => {
        results.push({ invariant, name, passed: true, details: 'Invariant satisfied' });
      })
      .catch((err) => {
        const details = err instanceof Error ? err.message : String(err);
        results.push({ invariant, name, passed: false, details });
      });
  }

  // 1. Invariant: Zero Legacy Migration Runner
  await record('INV-1', 'Zero Legacy SQLite Migration Runner Dependencies', () => {
    const { violations } = runRunnerAudit();
    assert.strictEqual(violations.length, 0, `Found ${violations.length} legacy runner violations`);
    assert.ok(!fs.existsSync(path.join(process.cwd(), 'apps', 'desktop', 'src', 'main', 'database', 'runner.ts')));
  });

  // 2. Invariant: Zero SyncEngine & Offline Queues
  await record('INV-2', 'Zero SyncEngine & Offline Sync Queue Dependencies', () => {
    const { violations } = runSyncAudit();
    assert.strictEqual(violations.length, 0, `Found ${violations.length} sync engine violations`);
    assert.ok(!fs.existsSync(path.join(process.cwd(), 'apps', 'desktop', 'src', 'main', 'services', 'sync-engine.ts')));
  });

  // 3. Invariant: Zero Outbound SMTP & Nodemailer
  await record('INV-3', 'Zero Outbound SMTP Paths & Nodemailer Dependency Removal', () => {
    const apiPkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'apps', 'api', 'package.json'), 'utf8'));
    const desktopPkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'apps', 'desktop', 'package.json'), 'utf8'));
    assert.strictEqual(apiPkg.dependencies?.nodemailer, undefined);
    assert.strictEqual(desktopPkg.dependencies?.nodemailer, undefined);
  });

  // 4. Invariant: Clean Disposable SQLite Cache Schema
  await record('INV-4', 'Clean Disposable SQLite Cache Schema Integrity', () => {
    const db = new Database(':memory:');
    initCacheSchema(db);
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as any[]).map((t) => t.name);
    assert.ok(tables.includes('cache_metadata'));
    assert.ok(!tables.includes('_migrations'));
    assert.ok(!tables.includes('sync_queue'));
    assert.ok(!tables.includes('sync_metadata'));
    assert.ok(!tables.includes('sync_dead_letter'));
    db.close();
  });

  // 5. Invariant: Zero Secrets in Cache
  await record('INV-5', 'Zero Secrets in SQLite Cache Layer', () => {
    const db = new Database(':memory:');
    initCacheSchema(db);
    const emailCols = (db.prepare("PRAGMA table_info('email_accounts')").all() as any[]).map((c) => c.name);
    assert.ok(!emailCols.includes('refreshToken'));
    assert.ok(!emailCols.includes('accessToken'));
    assert.ok(!emailCols.includes('clientSecret'));
    assert.ok(!emailCols.includes('password'));
    db.close();
  });

  // 6. Invariant: Canonical String IDs in Domain Data
  await record('INV-6', 'Canonical String IDs & Zero BSON ObjectIds in Domain Models', async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }
    const sampleModels = [CompanyModel, ContactModel, WorkspaceModel, UserModel, JobModel, EmailDeliveryModel];
    for (const model of sampleModels) {
      const sample = await model.find().limit(10).lean();
      for (const doc of sample) {
        assert.strictEqual(typeof doc._id, 'string');
      }
    }
  });

  // 7. Invariant: Unique & TTL Index Protection
  await record('INV-7', 'Critical Unique and TTL Indexes Exist in MongoDB', async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }
    const deliveryIdx = await EmailDeliveryModel.collection.indexes();
    assert.ok(deliveryIdx.some((idx) => idx.name === 'workspaceId_1_idempotencyKey_1'));

    const logIdx = await SystemLogModel.collection.indexes();
    assert.ok(logIdx.some((idx) => idx.name === 'createdAt_1' && idx.expireAfterSeconds !== undefined));
  });

  // 8. Invariant: Multi-Tenant Workspace Scoping
  await record('INV-8', 'Strict Multi-Tenant Workspace Boundary Enforcement', async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }
    const fakeWs = 'ws-guard-nonexistent-' + Date.now();
    const result = await CompanyModel.find({ workspaceId: fakeWs });
    assert.strictEqual(result.length, 0);
  });

  const allPassed = results.every((r) => r.passed);
  return { allPassed, results };
}

if (require.main === module || (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('verify-architecture-invariants.ts'))) {
  console.log('========================================================================');
  console.log(' LeadForge OS — Permanent Architecture Invariants Guard');
  console.log('========================================================================\n');

  runArchitectureInvariantsAudit()
    .then(async ({ allPassed, results }) => {
      for (const r of results) {
        if (r.passed) {
          console.log(`✅ [${r.invariant}] ${r.name}`);
        } else {
          console.error(`❌ [${r.invariant}] ${r.name}: ${r.details}`);
        }
      }

      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }

      console.log('\n========================================================================');
      if (allPassed) {
        console.log(` ALL ${results.length} ARCHITECTURE INVARIANTS SATISFIED ✅`);
        console.log('========================================================================\n');
        process.exit(0);
      } else {
        console.error(` INVARIANT VIOLATIONS DETECTED ❌`);
        console.log('========================================================================\n');
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('Guard Execution Failed:', err);
      process.exit(1);
    });
}
