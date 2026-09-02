import * as fs from 'fs';
import * as path from 'path';

/**
 * LeadForge OS — Static Sync Dependency Audit (Phase 11)
 *
 * Scans all active production source trees to ensure 0 runtime dependencies
 * on the obsolete SyncEngine, sync queues, sync tables, or sync status logic.
 */

interface AuditViolation {
  file: string;
  line: number;
  pattern: string;
  snippet: string;
}

const ROOT_DIR = path.resolve(__dirname, '..');

const SCAN_DIRS = [
  path.join(ROOT_DIR, 'apps', 'desktop', 'src', 'main'),
  path.join(ROOT_DIR, 'apps', 'desktop', 'src', 'renderer'),
  path.join(ROOT_DIR, 'apps', 'desktop', 'src', 'preload'),
  path.join(ROOT_DIR, 'apps', 'api', 'src'),
  path.join(ROOT_DIR, 'packages', 'sdk', 'src'),
  path.join(ROOT_DIR, 'packages', 'schema', 'src')
];

const EXCLUDED_FILES = [
  '.test.ts',
  '.test.js',
  '.spec.ts',
  '.spec.js'
];

const FORBIDDEN_PATTERNS = [
  { name: 'SyncEngine Import/Reference', regex: /\bSyncEngine\b/ },
  { name: 'sync_queue Access', regex: /\bsync_queue\b/ },
  { name: 'sync_dead_letter Access', regex: /\bsync_dead_letter\b/ },
  { name: 'sync_metadata Access', regex: /\bsync_metadata\b/ },
  { name: 'LocalQueueRepository Reference', regex: /\bLocalQueueRepository\b/ },
  { name: 'db:queue IPC Channels', regex: /['"]db:queue:/ },
  { name: 'enqueueMutation Helper', regex: /\benqueueMutation\b/ },
  { name: 'enqueueSync Helper', regex: /\benqueueSync\b/ },
  { name: 'syncStatus = pending Write', regex: /syncStatus\s*[:=]\s*['"]pending['"]/ }
];

function scanFile(filePath: string): AuditViolation[] {
  const violations: AuditViolation[] = [];
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip single-line comments in files that merely describe invariants (e.g. cache-schema.ts comment)
    const trimmed = line.trim();
    if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
      continue;
    }

    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.regex.test(line)) {
        violations.push({
          file: path.relative(ROOT_DIR, filePath),
          line: i + 1,
          pattern: pattern.name,
          snippet: trimmed
        });
      }
    }
  }

  return violations;
}

function walkDir(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.turbo') {
        walkDir(fullPath, fileList);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js'))) {
      const isExcluded = EXCLUDED_FILES.some((exc) => entry.name.includes(exc));
      if (!isExcluded) {
        fileList.push(fullPath);
      }
    }
  }

  return fileList;
}

export function runSyncDependencyAudit(): { totalFilesScanned: number; violations: AuditViolation[] } {
  const allFiles: string[] = [];
  for (const dir of SCAN_DIRS) {
    walkDir(dir, allFiles);
  }

  const allViolations: AuditViolation[] = [];
  for (const file of allFiles) {
    const violations = scanFile(file);
    allViolations.push(...violations);
  }

  return {
    totalFilesScanned: allFiles.length,
    violations: allViolations
  };
}

async function main() {
  console.log('========================================================================');
  console.log(' LeadForge OS — Static Sync Dependency Audit (Phase 11)');
  console.log('========================================================================\n');

  const result = runSyncDependencyAudit();

  console.log(`Total production source files scanned: ${result.totalFilesScanned}`);
  console.log(`Total sync violations found: ${result.violations.length}\n`);

  if (result.violations.length > 0) {
    console.error('❌ FORBIDDEN SYNC DEPENDENCIES DETECTED:');
    for (const v of result.violations) {
      console.error(`  - [${v.pattern}] ${v.file}:${v.line} -> "${v.snippet}"`);
    }
    process.exit(1);
  } else {
    console.log('✅ ZERO RUNTIME SYNC DEPENDENCIES CONFIRMED ACROSS ALL SOURCE TREES.');
    console.log('SyncEngine, sync_queue, sync_dead_letter, sync_metadata, and syncStatus writes are 100% eliminated.\n');
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
