# LeadForge OS — New Packages

> **Document Type**: Implementation Contract  
> **Source Specs**: scraping_pipeline_spec.md §3, §4, §4.6; automation_engine_spec.md; runtime_health_report.md  
> **Phase**: 9 — Implementation  
> **Note**: Do NOT install any package from this document. This document specifies what must be installed, why, and by whom.

---

## Package 001 — playwright

| Field               | Detail                                                                                                                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Package**         | `playwright` or `@playwright/test`                                                                                                                                                                                                                                  |
| **Version**         | Latest stable (≥1.44)                                                                                                                                                                                                                                               |
| **Install Target**  | `apps/desktop` (devDependency + production for packaged app)                                                                                                                                                                                                        |
| **Why**             | Google Maps is a JavaScript SPA. Static HTTP requests return no listing data. Playwright (headless Chromium) is the only viable engine. Specified in `scraping_pipeline_spec.md §3.2`.                                                                              |
| **Where Imported**  | `apps/desktop/src/main/workers/plugins/scraper.ts` only. Never in Main process, never in renderer.                                                                                                                                                                  |
| **Who Imports**     | The forked worker process exclusively.                                                                                                                                                                                                                              |
| **Runtime Impact**  | High. Playwright downloads Chromium (~150MB). Each browser context consumes 100–300MB RAM. Concurrency limited to 1 per workspace by design.                                                                                                                        |
| **Security Impact** | Chromium runs as a subprocess. It operates fully offline (no external network beyond target sites). `executablePath` should be pinned if distributing packaged builds. Review Playwright sandbox flags for Electron compatibility (`--no-sandbox` may be required). |
| **Licensing**       | Apache 2.0 — permissive, suitable for commercial use.                                                                                                                                                                                                               |
| **Alternatives**    | `puppeteer` (Google-maintained, similar API, Chromium-based). Rejected because Playwright has better cross-platform support and a more stable IPC story in Electron environments.                                                                                   |
| **UNKNOWN**         | Does the Electron packager (electron-builder) correctly bundle Playwright's Chromium binary? **Required Investigation**: Verify Playwright browser binary path resolution works in packaged Electron builds on Windows.                                             |

---

## Package 002 — cheerio

| Field               | Detail                                                                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Package**         | `cheerio`                                                                                                                                                                                                           |
| **Version**         | Latest stable (`^1.0.0`)                                                                                                                                                                                            |
| **Install Target**  | `apps/desktop`                                                                                                                                                                                                      |
| **Why**             | Website crawling and contact extraction from static/SSR HTML. Specified in `scraping_pipeline_spec.md §4.1` as the primary engine for `crawler:website` and `enrich:website`.                                       |
| **Where Imported**  | `apps/desktop/src/main/workers/plugins/crawler.ts`, `apps/desktop/src/main/workers/plugins/enricher.ts`                                                                                                             |
| **Who Imports**     | Worker process only.                                                                                                                                                                                                |
| **Runtime Impact**  | Low. Cheerio is pure JavaScript, no native bindings. Parses HTML in memory — no subprocess overhead.                                                                                                                |
| **Security Impact** | Cheerio is a server-side HTML parser. No XSS risk in this context. Does not execute JavaScript. Input is untrusted HTML from crawled websites — do NOT pass parsed values directly to `eval()` or template engines. |
| **Licensing**       | MIT — permissive.                                                                                                                                                                                                   |
| **Alternatives**    | `jsdom` (heavier, executes JS), `htmlparser2` (lower-level, Cheerio's underlying parser). Cheerio is the correct choice.                                                                                            |

---

## Package 003 — node-fetch (or built-in fetch)

| Field               | Detail                                                                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Package**         | Node.js built-in `fetch` (Node ≥18) OR `node-fetch@3`                                                                                                                                                                                |
| **Version**         | Use built-in if Electron's Node version ≥18. Otherwise `node-fetch@^3.3`                                                                                                                                                             |
| **Install Target**  | `apps/desktop`                                                                                                                                                                                                                       |
| **Why**             | HTTP requests for website crawling and robots.txt fetching in the worker. Specified in `scraping_pipeline_spec.md §4`                                                                                                                |
| **Where Imported**  | `apps/desktop/src/main/workers/plugins/crawler.ts`                                                                                                                                                                                   |
| **Who Imports**     | Worker process only.                                                                                                                                                                                                                 |
| **Runtime Impact**  | Minimal. Native network I/O.                                                                                                                                                                                                         |
| **Security Impact** | All requests go to user-provided external URLs. Validate URL format before fetch. Do not follow redirects to `file://` or `data://` URLs. Set explicit `timeout` (10s per spec).                                                     |
| **Licensing**       | MIT                                                                                                                                                                                                                                  |
| **UNKNOWN**         | What version of Node.js is bundled with the current Electron version? **Required Investigation**: Check `engines.node` in package.json and Electron release notes to confirm whether native `fetch` is available without a polyfill. |

---

## Package 004 — robots-parser

| Field               | Detail                                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Package**         | `robots-parser`                                                                                                              |
| **Version**         | Latest stable (`^3.0.0`)                                                                                                     |
| **Install Target**  | `apps/desktop`                                                                                                               |
| **Why**             | Crawlers must respect `robots.txt` to avoid IP bans and respect site terms. Specified in `scraping_pipeline_spec.md §4.6`.   |
| **Where Imported**  | `apps/desktop/src/main/workers/plugins/crawler.ts`                                                                           |
| **Who Imports**     | Worker process only.                                                                                                         |
| **Runtime Impact**  | Minimal. Parses robots.txt in-memory, no I/O of its own.                                                                     |
| **Security Impact** | Low. Reads robots.txt from external servers. Must handle malformed/oversized robots.txt files gracefully (truncate if >1MB). |
| **Licensing**       | MIT                                                                                                                          |
| **Alternatives**    | `robots-txt-parser`, manual regex. `robots-parser` is the most widely used and correct implementation.                       |

---

## Package 005 — nodemailer

| Field               | Detail                                                                                                                                                                                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Package**         | `nodemailer`                                                                                                                                                                                                                                                                      |
| **Version**         | Latest stable (`^6.9`)                                                                                                                                                                                                                                                            |
| **Install Target**  | `apps/desktop`                                                                                                                                                                                                                                                                    |
| **Why**             | Real SMTP email dispatch for the `outreach:campaign` plugin. Specified in `runtime_health_report.md §W2`. The current plugin simulates sending.                                                                                                                                   |
| **Where Imported**  | `apps/desktop/src/main/workers/plugins/outreach.ts`                                                                                                                                                                                                                               |
| **Who Imports**     | Worker process only.                                                                                                                                                                                                                                                              |
| **Runtime Impact**  | Moderate. Opens TCP connection to SMTP server per email or batch. Long-running sessions with large campaigns. Must respect rate limits (per spec: `dailyLimit`, `hourlyLimit` from `email_accounts` table).                                                                       |
| **Security Impact** | **High**. SMTP credentials are stored in the SQLite `email_accounts` table. Must never be passed through IPC or logged. Workers read credentials directly from SQLite. Credentials must not appear in `system_logs`. TLS must be enforced (`secure: true` or `requireTLS: true`). |
| **Licensing**       | MIT                                                                                                                                                                                                                                                                               |
| **Alternatives**    | `@sendgrid/mail` (API-based, not local), `resend` (API-based). Both rejected because the architecture requires local SMTP, not cloud relay.                                                                                                                                       |

---

## Package 006 — p-limit

| Field               | Detail                                                                                                                                                                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Package**         | `p-limit`                                                                                                                                                                                                                                                        |
| **Version**         | `^6.1.0` (ESM-only in v4+; verify CJS compatibility in worker context)                                                                                                                                                                                           |
| **Install Target**  | `apps/desktop`                                                                                                                                                                                                                                                   |
| **Why**             | Concurrency limiting for the website crawler's BFS page queue. Specified in `scraping_pipeline_spec.md §4.7`. The archive worker already uses `p-limit`.                                                                                                         |
| **Where Imported**  | `apps/desktop/src/main/workers/plugins/crawler.ts`                                                                                                                                                                                                               |
| **Who Imports**     | Worker process only.                                                                                                                                                                                                                                             |
| **Runtime Impact**  | Minimal. Manages Promise concurrency in-process.                                                                                                                                                                                                                 |
| **Security Impact** | None.                                                                                                                                                                                                                                                            |
| **Licensing**       | MIT                                                                                                                                                                                                                                                              |
| **UNKNOWN**         | `p-limit` v4+ is ESM-only. The worker-host compiles to CJS per spec (worker_runtime_spec.md §4.1). **Required Investigation**: Verify whether `p-limit@3.x` (last CJS-compatible version) is sufficient, or whether the worker build must be configured for ESM. |

---

## Package 007 — email-validator (or validator.js)

| Field               | Detail                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Package**         | `email-validator` OR `validator` (both include email validation)                                                                                                               |
| **Version**         | `email-validator@^2.0.4` or `validator@^13.12`                                                                                                                                 |
| **Install Target**  | `apps/desktop`                                                                                                                                                                 |
| **Why**             | Contact emails extracted from crawled pages must be validated before insertion. Specified in `scraping_pipeline_spec.md §4.4`. Prevents garbage emails from polluting the CRM. |
| **Where Imported**  | `apps/desktop/src/main/workers/plugins/enricher.ts`, `apps/desktop/src/main/workers/plugins/crawler.ts`                                                                        |
| **Who Imports**     | Worker process only.                                                                                                                                                           |
| **Runtime Impact**  | Minimal. Regex-based validation, no network.                                                                                                                                   |
| **Security Impact** | None.                                                                                                                                                                          |
| **Licensing**       | `email-validator`: MIT. `validator`: MIT.                                                                                                                                      |
| **Note**            | MX record validation (network-based) is optional and must only be enabled if explicitly configured — it adds latency per contact. Default is format-only validation.           |

---

## Package 008 — @types/cheerio, @types/nodemailer (Type Definitions)

| Field               | Detail                                                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Package**         | `@types/cheerio`, `@types/nodemailer`                                                                                                  |
| **Version**         | Latest matching major                                                                                                                  |
| **Install Target**  | `apps/desktop` devDependencies                                                                                                         |
| **Why**             | TypeScript compilation requires type definitions for both packages.                                                                    |
| **Where Imported**  | Compile-time only                                                                                                                      |
| **Security Impact** | None                                                                                                                                   |
| **Licensing**       | MIT                                                                                                                                    |
| **Note**            | `playwright` ships its own types. `robots-parser` may or may not have `@types/robots-parser` — investigate. `p-limit` ships own types. |

---

## Package 009 — is-electron (already used — verify)

| Field                      | Detail                                                                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Package**                | `electron-is-dev` or `electron-util`                                                                                                         |
| **Why**                    | Scheduler uses `is.dev` to set `execArgv` for worker debugging. The spec (worker_runtime_spec.md §4.7) uses `is.dev ? ['--inspect=0'] : []`. |
| **Current State**          | **UNKNOWN** — verify whether `is` (from `electron-util`) is already imported in `scheduler.ts`.                                              |
| **Required Investigation** | Check `scheduler.ts` imports and `package.json` devDependencies for existing `is-dev` utility.                                               |

---

## Summary Table

| Package                  | Target      | Purpose                       | Priority | Risk                        |
| ------------------------ | ----------- | ----------------------------- | -------- | --------------------------- |
| `playwright`             | desktop     | Google Maps scraping          | P0       | High (binary size, sandbox) |
| `cheerio`                | desktop     | Website crawling + extraction | P0       | Low                         |
| `node-fetch` or built-in | desktop     | HTTP requests in workers      | P0       | Low                         |
| `robots-parser`          | desktop     | robots.txt compliance         | P0       | Low                         |
| `nodemailer`             | desktop     | Real SMTP dispatch            | P0       | High (credentials security) |
| `p-limit`                | desktop     | Crawler concurrency           | P0       | Medium (ESM/CJS conflict)   |
| `email-validator`        | desktop     | Email format validation       | P1       | Low                         |
| `@types/cheerio`         | desktop dev | TypeScript types              | P1       | None                        |
| `@types/nodemailer`      | desktop dev | TypeScript types              | P1       | None                        |
