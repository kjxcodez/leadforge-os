# Testing & Quality Assurance

This document details our testing philosophy, available test suites, and validation utilities designed to maintain codebase health.

---

## 💡 Testing Philosophy

1. **Isolation by Design**: Unit tests should never invoke real network requests, write to production workspace databases, or spawn active headless browsers.
2. **Deterministic Outputs**: Test scripts must yield predictable results. Use deterministic clock tickers, transaction rollbacks, and mock LLM configurations.
3. **Double Verification**: Automated test suites are complemented by SRE runtime diagnostics (`doctor`) and release gate checks.

---

## 🧪 Available Test Suites

### 1. Unit & Integration Tests

Runs test files located in the `src/tests/` folders inside individual packages (e.g. `packages/agent-core`).

- **Command**:
  ```bash
  pnpm -r test
  ```
- **Focus**: Validates utilities, validators, CRM repositories, and schema parsers.

### 2. AI Integration Tests (`test-ai.ts`)

Validates model provider connections, timeouts, Zod output schema parsing, and fallback mock completions.

- **Command**:
  ```bash
  pnpm test:ai
  ```
- **Source**: [scripts/test-ai.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/scripts/test-ai.ts)
- **Parameters Check**: Verifies that OpenRouter responses match structured Zod definitions (e.g. `OpeningLineOutputSchema`).

### 3. Headless Subsystem Smoke Tests (`smoke-test.ts`)

Executes a simulated Electron process headlessly to verify migrations, EventBuses, and logging loops.

- **Command**:
  ```bash
  pnpm test
  # Or manually:
  npx tsx scripts/smoke-test.ts
  ```
- **Source**: [scripts/smoke-test.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/scripts/smoke-test.ts)
- **Checklist**:
  - Connects to an in-memory SQLite instance.
  - Applies all 23 database migrations.
  - Triggers EventBus publishers and verifies subscribers.
  - Boots a test `JobScheduler` instance.

---

## 🩺 SRE Diagnostic & Release Checks

We provide two pre-configured SRE scripts to inspect local configurations and prepare builds:

### 1. Doctor Diagnostics (`pnpm doctor`)

The doctor diagnostics script tests environment versions, repository health, compilation status, lint rules, and test success.

```bash
# Run SRE Doctor
pnpm doctor
```

**Checks Performed**:

1. Node version compliance ($\ge v18.0.0$).
2. pnpm version validity.
3. Electron version definition.
4. Git cleanliness status.
5. Runs [verify-repo-health.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/scripts/verify-repo-health.ts).
6. Runs ESLint.
7. Performs TypeScript type checking.
8. Checks architectural boundaries (`dependency-cruiser`).
9. Runs recursive package test suites (`pnpm -r test`).
10. Writes a Markdown diagnostics report to `report/doctor-report.md`.

---

### 2. Release Gate Verification (`pnpm release:check`)

A strict 10-gate check that must pass before any version distribution is allowed:

```bash
# Execute Release Gates
pnpm release:check
```

**Gates Checklist**:

1. **Gate 1**: Repository Health check.
2. **Gate 2**: TypeScript typecheck.
3. **Gate 3**: ESLint validation.
4. **Gate 4**: Unit & Integration tests.
5. **Gate 5**: AI Integration tests (optional).
6. **Gate 6**: Headless Desktop Subsystem smoke test.
7. **Gate 7**: Desktop Bundling Dry-Run.
8. **Gate 8**: Changeset and release notes checking.
9. **Gate 9**: Git status cleanliness checking.
10. **Gate 10**: Tag & Version synchronization verify.

---

## 🛠️ Mocking Strategies

### Mocking LLM Providers

In unit tests, use the `'mock'` provider to bypass OpenRouter connections. The prompt runner will return pre-set structures:

```typescript
import { PromptRunner } from '@leadforge/ai';

const runner = new PromptRunner({
  provider: 'mock',
  model: 'stub-model'
});

// Returns deterministic outputs instantly without network calls
const summary = await runner.generateSummary({ domain: 'google.com' });
```

### Mocking Electron

For running desktop main process tests outside Electron (where `safeStorage` or `ipcMain` are unavailable), we provide a mock wrapper at [scripts/mock-electron.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/scripts/mock-electron.ts). Import this script at the absolute top of your test entry points to prevent runtime errors:

```typescript
import { mockElectron } from './mock-electron';
// ... other imports
```
