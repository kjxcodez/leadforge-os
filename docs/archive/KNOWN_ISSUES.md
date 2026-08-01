# Known Issues

This document tracks known issues, workarounds, and resolved states for the LeadForge OS Closed Beta program.

---

## 1. Active Beta Issues

### 1.1 Unsigned Binary Alerts

- **Symptom**: Windows SmartScreen blocks launch on installer launch.
- **Workaround**: Click "More Info" -> "Run anyway". See [Tester Guide](TESTER_GUIDE.md) for step-by-step walkthroughs.
- **Status**: Expected behavior for early closed beta releases.

### 1.2 Local tsx Native SQLite DLOpen Failures

- **Symptom**: Executing integration tests in standard Node.js shell outside Electron yields a DLOpen error: `better_sqlite3.node was compiled against a different Node.js version`.
- **Workaround**: Run tests using the native electron context wrapper `pnpm test` or `npx electron scripts/smoke-test.js` where the ABI matches perfectly.
- **Status**: Open, expected behavior due to Node-to-Electron ABI differences.

### 1.3 Delayed SQLite Extraction

- **Symptom**: SQLite repositories are located under `apps/desktop` instead of `@leadforge/database`.
- **Status**: Postponed by design until contract interfaces stabilize.

---

## 2. Reporting New Issues

If you hit a problem not listed above:

1. Generate the Support Bundle ZIP in **Diagnostics**.
2. Click **Report Bug** to open a new pre-formatted issue.
3. Attach the ZIP and paste the copied clipboard metadata.
