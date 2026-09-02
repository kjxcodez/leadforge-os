# Phase 1 Forensic Document 21 — Automated Test Coverage & Trust Reality

**Document Type:** Forensic Test Harness & Coverage Audit  
**Audited Against:** `scripts/verify-phase*.ts`, `apps/desktop/src/main/services/*.test.ts`, `packages/sdk/**/*.test.ts`  
**Date:** September 2026  
**Status:** Authoritative Baseline  

---

## 1. Test Suite Classification & Execution Scope

| Test Suite / Script | Classification | Real Environment Tested | What It Does NOT Test (The Blind Spots) | Why It Could PASS While Product Failed |
| :--- | :--- | :--- | :--- | :--- |
| `scripts/verify-phase13.ts` | **MOCKED INTEGRATION** | Standalone Node.js process + in-memory database | Does NOT test Electron main process, IPC bridging, or React Query. | Tested SDK functions in isolation with mock payloads, passing without verifying Electron runtime data flows. |
| `scripts/verify-phase10.ts` | **UNIT / SCHEMA** | Local SQLite + Mongoose | Does NOT test real Playwright browser scraping or worker fork. | Directly invoked `LocalCRMRepository.saveFromServer()`, assuming all production workers would do the same. |
| `scripts/verify-phase15.ts` | **UNIT / PROTOTYPE** | Node.js unit tests | Does NOT test live Gmail OAuth handshake in Chrome or live Drive uploads. | Verified pure functions (`MimeBuilder`, `renderCanonicalVariables`) with hardcoded valid objects. |
| `scripts/verify-phase17-defects.ts` | **TARGETED PROBE** | Local process check | Does NOT test UI table rendering or user interaction. | Verified bug fixes in isolation against synthetic test inputs. |
| `scripts/verify-product-workflows.ts`| **MOCKED WORKFLOW** | Node.js test harness | Does NOT run live Electron BrowserWindow or Chromium renderer. | Simulated workflow transitions using direct method calls, bypassing IPC serialization and React re-renders. |

---

## 2. Concrete Discrepancy Examples

### Example 1: Scraper Discovery Count Discrepancy
- **Why Tests Passed:** `verify-phase10.ts` tested `scraper:maps` by mocking 5 business objects and directly calling `LocalCRMRepository.saveManyFromServer('companies', mockCompanies)`. The test asserted `companies.length === 5` in SQLite and passed with a green checkmark.
- **Why Product Failed in Real Life:** In the real product, `scraper.ts` runs inside a child worker process and calls `sdk.companies.create()` (writing to MongoDB only). It does NOT write to SQLite. When the user opens the UI, the IPC handler queries SQLite (which was never updated by the worker), displaying 0 or 1 stale company.

### Example 2: Email Deliveries Table Query Failure
- **Why Tests Passed:** `verify-phase13.ts` tested `sdk.emailDeliveries.list({ page: 1, limit: 10 })` with explicit valid numbers.
- **Why Product Failed in Real Life:** In the real React UI (`CampaignsScreen.tsx`), the query hook passed `{ campaignId: undefined, sequenceId: undefined, status: undefined }`, triggering `URLSearchParams` to serialize `"undefined"` strings to the API, returning empty arrays.

---

## 3. Trust Verdict

> [!WARNING]
> Existing test scripts are **valuable unit proofs for isolated helper functions**, but **CANNOT BE TREATED AS EVIDENCE OF END-TO-END PRODUCT READINESS**. Passing test scripts frequently masked runtime defects because they bypassed the Electron Main-to-Renderer IPC boundary and SQLite cache hydration dependency.
