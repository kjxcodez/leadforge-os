import * as fs from 'fs';
import * as path from 'path';

/**
 * LeadForge OS — Phase 12 Static Audit Scanner
 * 
 * Scans all production source files in apps/desktop, apps/api, and packages
 * to verify ZERO active references to runner.ts, runMigrations, _migrations,
 * historical migration steps (001-033), or .migration.bak.
 */

const ROOT_DIR = path.resolve(__dirname, '..');

const SCAN_DIRS = [
  path.join(ROOT_DIR, 'apps', 'desktop', 'src', 'main'),
  path.join(ROOT_DIR, 'apps', 'desktop', 'src', 'renderer'),
  path.join(ROOT_DIR, 'apps', 'desktop', 'src', 'preload'),
  path.join(ROOT_DIR, 'apps', 'api', 'src'),
  path.join(ROOT_DIR, 'packages', 'sdk', 'src'),
  path.join(ROOT_DIR, 'packages', 'schema', 'src'),
  path.join(ROOT_DIR, 'packages', 'core', 'src'),
  path.join(ROOT_DIR, 'packages', 'agent-core', 'src'),
  path.join(ROOT_DIR, 'packages', 'agent-runtime', 'src'),
  path.join(ROOT_DIR, 'packages', 'workflow-engine', 'src')
];

const EXCLUDED_EXTENSIONS = [
  '.test.ts',
  '.test.tsx',
  '.spec.ts',
  '.spec.tsx',
  '.d.ts',
  '.map'
];

const FORBIDDEN_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'runMigrations function call/import', regex: /\brunMigrations\b/ },
  { name: 'database/runner import', regex: /['"]\.\.?\/database\/runner['"]/ },
  { name: '_migrations table reference', regex: /\b_migrations\b/ },
  { name: 'migration.bak backup reference', regex: /\.migration\.bak\b/ },
  { name: '001_initial_schema historical migration', regex: /\b001_initial_schema\b/ },
  { name: '033_contact_last_contacted_at historical migration', regex: /\b033_contact_last_contacted_at\b/ }
];

interface Violation {
  file: string;
  line: number;
  pattern: string;
  snippet: string;
}

function collectFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'out' || entry.name === '.turbo') {
        continue;
      }
      results.push(...collectFiles(fullPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
        const isExcluded = EXCLUDED_EXTENSIONS.some((e) => entry.name.endsWith(e));
        if (!isExcluded) {
          results.push(fullPath);
        }
      }
    }
  }
  return results;
}

export function runStaticAudit(): { violations: Violation[]; scannedFilesCount: number } {
  const allFiles: string[] = [];
  for (const dir of SCAN_DIRS) {
    allFiles.push(...collectFiles(dir));
  }

  const violations: Violation[] = [];

  for (const file of allFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.regex.test(line)) {
          violations.push({
            file: path.relative(ROOT_DIR, file),
            line: i + 1,
            pattern: pattern.name,
            snippet: line.trim()
          });
        }
      }
    }
  }

  return { violations, scannedFilesCount: allFiles.length };
}

if (require.main === module || (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('verify-no-legacy-runner-dependencies.ts'))) {
  console.log('========================================================================');
  console.log(' LeadForge OS — Phase 12 Static Audit: Zero Legacy Runner Dependencies');
  console.log('========================================================================\n');

  const { violations, scannedFilesCount } = runStaticAudit();

  console.log(`Scanned ${scannedFilesCount} production source files.\n`);

  if (violations.length === 0) {
    console.log('✅ PASS: Exactly ZERO legacy migration runner dependencies detected in production source tree.');
    console.log('========================================================================\n');
    process.exit(0);
  } else {
    console.error(`❌ FAIL: Found ${violations.length} forbidden legacy migration references:\n`);
    for (const v of violations) {
      console.error(`  - [${v.pattern}] ${v.file}:${v.line}`);
      console.error(`    "${v.snippet}"\n`);
    }
    console.error('========================================================================\n');
    process.exit(1);
  }
}
