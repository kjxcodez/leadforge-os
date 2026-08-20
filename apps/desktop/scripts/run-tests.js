const { execSync } = require('child_process');
const path = require('path');

const tests = [
  'src/main/services/onboarding.test.ts',
  'src/main/services/updater.test.ts',
  'src/main/services/intelligence.test.ts',
  'src/main/ai/tools/adapter.test.ts',
  'src/main/mail/mail.test.ts',
  'src/main/services/campaign.test.ts'
];

let failed = false;

for (const test of tests) {
  const testPath = path.join(__dirname, '..', test);
  console.log(`[Desktop Test] Running ${test}...`);
  try {
    execSync(`npx tsx "${testPath}"`, { stdio: 'pipe' });
    console.log(`[Desktop Test] PASS: ${test}\n`);
  } catch (err) {
    const errorStr =
      (err.message || '') +
      (err.stderr ? err.stderr.toString() : '') +
      (err.stdout ? err.stdout.toString() : '');
    if (
      errorStr.includes('ERR_DLOPEN_FAILED') ||
      errorStr.includes('different Node.js version') ||
      errorStr.includes('node_module_version')
    ) {
      console.log(
        `[Desktop Test] SKIP: ${test} (Native sqlite binary compiled for Electron, skipping in Node host environment)\n`
      );
    } else {
      console.error(`[Desktop Test] FAIL: ${test}`);
      console.error(errorStr);
      console.error('\n');
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
} else {
  process.exit(0);
}
