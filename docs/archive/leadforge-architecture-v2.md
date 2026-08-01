# LeadForge — Full Architecture (v2: Desktop + API + Local Cache)

**Status:** Supersedes the standalone-desktop assumptions in earlier architecture docs. Also corrects a contradiction from the prior draft, which said "no local database" after earlier correctly describing SQLite as a cache — this version is the reconciled, final position.
**Core decision:** Two apps from day 1 — `apps/desktop` (Electron) and `apps/api` (Hono, on Vercel) — sharing MongoDB Atlas as the single, permanent source of truth. The desktop **also** keeps a local SQLite database, but it plays one role only: a read cache (so the UI is instant and usable even on a slow connection) and a write queue (so an action taken while offline isn't lost — it syncs the moment connectivity returns). SQLite never wins a conflict against Atlas, never gets queried as "the answer," and could be deleted at any time with zero permanent data loss.

---

## 1. The Whole System, One Picture

```
┌────────────────────────────────────────────────────────────┐
│  apps/desktop  (Electron — runs on GTM's laptop)             │
│                                                                │
│  renderer (React)  ──window.api──▶  preload  ──IPC──▶  main   │
│                                                          │      │
│                              ┌───────────────────────────┤      │
│                              │  main/services             │      │
│                              │  main/system (supervisor)  │      │
│                              │  main/integrations         │      │
│                              │  main/cache (SQLite) ◄──┐  │      │
│                              │   read-cache + write-queue │      │
│                              └──────────┬──────────────────┘      │
│                                          │ HTTPS + JWT             │
└──────────────────────────────────────────┼─────────────────────┘
                                            ▼
                              ┌──────────────────────────┐
                              │  apps/api  (Hono, Vercel)  │
                              │  routes → services →       │
                              │  repositories → Mongoose   │
                              └─────────────┬──────────────┘
                                            ▼
                              ┌──────────────────────────┐
                              │   MongoDB Atlas            │
                              │   (the ONE source of truth)│
                              └──────────────────────────┘
```

**The one rule that keeps this whole system honest:** `apps/desktop` never imports Mongoose and never opens a database connection. It only ever calls `apps/api` over HTTPS. `apps/api` is the only code in the entire monorepo allowed to talk to MongoDB. If you ever find yourself importing a Mongo client inside `apps/desktop`, that's the bug to catch in code review.

---

## 2. Full Directory Structure

```text
leadforge-os/
├── apps/
│   ├── desktop/                        # Electron client — the product GTM installs
│   │   ├── src/
│   │   │   ├── main/                    # Node.js process — the only place with OS/network access
│   │   │   │   ├── windows/              # BrowserWindow creation, tray, native menu
│   │   │   │   ├── ipc/                  # Thin handlers: ipcMain.handle(...). One file per domain.
│   │   │   │   │   ├── companies.ipc.ts
│   │   │   │   │   ├── contacts.ipc.ts
│   │   │   │   │   ├── auth.ipc.ts
│   │   │   │   │   └── system.ipc.ts     # start/stop/status for workers & scraper
│   │   │   │   ├── services/             # Business logic — calls api-client, never Mongo
│   │   │   │   │   ├── company.service.ts
│   │   │   │   │   ├── discovery.service.ts
│   │   │   │   │   └── auth.service.ts    # token storage via safeStorage, refresh logic
│   │   │   │   ├── integrations/          # Playwright wrapper, future adapters
│   │   │   │   │   └── scraper/
│   │   │   │   ├── system/                # The Process Supervisor (Section 5)
│   │   │   │   │   └── supervisor.ts
│   │   │   │   ├── cache/                 # SQLite — local cache + write queue (Section 6.5). NEVER the source of truth.
│   │   │   │   │   ├── db.ts               # SQLite connection (a single local .sqlite file)
│   │   │   │   │   ├── schema.ts           # `cached_companies`, `cached_contacts`, `pending_actions` tables
│   │   │   │   │   ├── cache.repository.ts # read/write to the local cache tables ONLY — never Mongo
│   │   │   │   │   └── sync-queue.ts       # enqueue/dequeue for `pending_actions`
│   │   │   │   ├── lib/                   # logger, config/env loading
│   │   │   │   └── index.ts               # app entrypoint
│   │   │   ├── preload/
│   │   │   │   └── index.ts               # contextBridge — the ONLY doorway into main
│   │   │   ├── renderer/                  # React app — zero Node access
│   │   │   │   ├── app/
│   │   │   │   │   ├── App.tsx
│   │   │   │   │   └── main.tsx
│   │   │   │   ├── routes/
│   │   │   │   ├── screens/                # DashboardScreen.tsx, CompaniesScreen.tsx, etc.
│   │   │   │   ├── components/
│   │   │   │   │   ├── ui/                  # shadcn primitives
│   │   │   │   │   ├── layout/
│   │   │   │   │   └── common/
│   │   │   │   ├── hooks/                   # useCompanies(), useSystemStatus(), etc.
│   │   │   │   ├── providers/                # TanStack Query provider, Auth provider
│   │   │   │   ├── lib/
│   │   │   │   └── styles/
│   │   │   └── shared/                     # Safe to import from BOTH main and renderer
│   │   │       └── ipc-contract.ts          # the typed channel map (Section 4)
│   │   ├── electron.vite.config.js
│   │   ├── electron-builder.yml
│   │   └── package.json
│   │
│   └── api/                             # Hono backend — deployed to Vercel
│       ├── src/
│       │   ├── routes/                   # HTTP route definitions (thin, like desktop's ipc/)
│       │   │   ├── companies.routes.ts
│       │   │   ├── contacts.routes.ts
│       │   │   └── auth.routes.ts        # mounts Better Auth's handler
│       │   ├── services/                 # Business logic — mirrors desktop's services/ in spirit
│       │   │   └── company.service.ts
│       │   ├── repositories/              # THE ONLY code allowed to import Mongoose
│       │   │   └── company.repository.ts
│       │   ├── db/
│       │   │   └── connection.ts          # cached Mongoose client (serverless-safe)
│       │   ├── auth/
│       │   │   └── index.ts               # Better Auth config
│       │   ├── middleware/
│       │   │   └── require-session.ts
│       │   └── index.ts                   # Hono app entrypoint
│       ├── vercel.json                    # usually unnecessary — Hono deploys with defaults
│       └── package.json
│
├── packages/                            # Shared code — real consumers now (desktop AND api)
│   ├── types/                             # Company, Contact, Workspace, Campaign shapes
│   ├── validation/                        # Zod schemas — same rule validates a form AND a route
│   ├── api-client/                        # Typed fetch wrapper; desktop's only way to reach the API
│   ├── ui/                                 # Design tokens + shared shadcn components
│   └── logger/                             # Pino wrapper, shared config
│
├── docs/
│   └── arch/                              # Keep, but reconcile against this file (Section 8)
│
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

---

## 3. Request Lifecycle — Reads vs. Writes Are Handled Differently

This is the shape every single feature follows. Learn this once, and every screen is the same pattern. Reads and writes diverge slightly once SQLite is in the picture, so both are shown below.

### 3.1 A read (e.g. "List Companies") — cache-first, then refresh from the real source

```
1. CompaniesScreen.tsx calls useCompanies() (a TanStack Query hook)
2. That hook calls window.api.companies.list(filters)
3. preload forwards it: ipcRenderer.invoke('companies:list', filters)
4. main/ipc/companies.ipc.ts validates `filters` with a Zod schema from packages/validation
5. main/services/company.service.ts checks main/cache/cache.repository.ts FIRST
   → if a cached copy exists, it's returned to the renderer IMMEDIATELY (instant UI, no spinner)
6. In parallel, the service also calls packages/api-client → apiClient.companies.list(filters)
   → this hits apps/api → repository → Mongo Atlas → returns the real, current DTOs
7. When the real response arrives, the service writes it into main/cache (overwriting the stale copy)
   and pushes an update event to the renderer, so TanStack Query silently refreshes the screen
8. If step 6 fails (no internet), the renderer just keeps showing the cached data from step 5,
   with a small "showing cached data — offline" indicator, instead of a hard error
```

This is the standard **stale-while-revalidate** pattern: cache makes it feel instant, the network call makes it correct, and a failure degrades gracefully to "slightly out of date" rather than "broken."

### 3.2 A write (e.g. "Create Company") — always try the API first; queue only on failure

```
1. CompanyForm.tsx calls window.api.companies.create(data)
2. main/services/company.service.ts calls apiClient.companies.create(data) directly — no cache involved
3a. SUCCESS: apps/api writes to Mongo Atlas, returns the created DTO;
    the service also writes this into the local cache (so it shows up instantly if queried again),
    and returns success to the renderer.
3b. FAILURE (network down / API unreachable): the service writes the attempted action into
    main/cache's `pending_actions` table instead — { type: 'companies:create', payload: data, createdAt }
    — and returns a clear "Saved locally — will sync when you're back online" result to the renderer,
    NOT a silent success and NOT a hard error.
4. The Sync Worker (Section 6) periodically drains `pending_actions`, retrying each queued write
   against the real API. On success, it removes the entry and updates the cache with the real result.
   On repeated failure, it surfaces a "3 changes waiting to sync" indicator in the System Health panel.
```

**The one rule that keeps this safe:** SQLite is never read as the answer to "did this write succeed" — only Atlas's response (now or eventually, via the sync worker) determines that. The cache is for _speed_, the queue is for _resilience_; neither is ever the arbiter of truth.

---

## 4. The Typed IPC Contract (do this once, use it everywhere)

Define every channel's input/output shape in one place so preload, main, and renderer can never silently drift out of sync:

```ts
// apps/desktop/src/shared/ipc-contract.ts
import { z } from 'zod';
import { CompanySchema, CompanyFiltersSchema } from '@leadforge/validation';

export const IpcContract = {
  'companies:list': {
    input: CompanyFiltersSchema,
    output: z.array(CompanySchema)
  },
  'system:start': {
    input: z.void(),
    output: z.object({ started: z.array(z.string()) })
  },
  'system:status': {
    input: z.void(),
    output: z.array(
      z.object({
        name: z.enum(['scraperWorker', 'jobWorker', 'emailWorker']),
        status: z.enum(['stopped', 'starting', 'running', 'crashed'])
      })
    )
  }
  // ...one entry per channel
} as const;
```

```ts
// apps/desktop/src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  companies: {
    list: (filters) => ipcRenderer.invoke('companies:list', filters)
  },
  system: {
    start: () => ipcRenderer.invoke('system:start'),
    stop: () => ipcRenderer.invoke('system:stop'),
    status: () => ipcRenderer.invoke('system:status'),
    onStatusChange: (cb) => ipcRenderer.on('system:status-changed', (_e, p) => cb(p)),
    onScraperProgress: (cb) => ipcRenderer.on('scraper:progress', (_e, p) => cb(p))
  }
});
```

---

## 5. Running the Scraper — Full End-to-End Flow

This is the part worth being precise about, since it's the one workflow with a live, long-running background process the UI needs to watch in real time.

### 5.1 The pieces involved

- **`main/system/supervisor.ts`** — spawns and tracks the scraper as a child process, forwards its output.
- **`main/integrations/scraper/`** — the actual Playwright code, run _inside_ that child process, not the main process.
- **IPC events** — the main process pushes live progress to the renderer; this is different from the request/response pattern in Section 3, because the renderer didn't ask a question and wait — it's being _told_ things as they happen.

### 5.2 Starting a scrape (user clicks "Run Discovery")

```tsx
// renderer/screens/DiscoveryScreen.tsx
const runDiscovery = async () => {
  await window.api.discovery.start({ query: 'MEP firms in Texas', source: 'google_maps' });
};
```

```ts
// main/ipc/discovery.ipc.ts
ipcMain.handle('discovery:start', async (_e, input) => {
  const parsed = DiscoveryStartSchema.parse(input); // Zod validation, fail loudly if malformed
  return discoveryService.start(parsed);
});
```

```ts
// main/services/discovery.service.ts
import { supervisor } from '../system/supervisor';

export async function start(input: DiscoveryInput) {
  supervisor.startScraper(input); // fire-and-forget; progress comes back via events, not a return value
  return { started: true };
}
```

### 5.3 The supervisor spawns Playwright in its own process

```ts
// main/system/supervisor.ts
import { fork } from 'node:child_process';
import { BrowserWindow } from 'electron';

class SystemSupervisor {
  private scraperProcess?: ReturnType<typeof fork>;

  startScraper(input: DiscoveryInput) {
    this.scraperProcess = fork(this.workerEntryPath('scraperWorker'), [], {
      stdio: ['ignore', 'pipe', 'pipe', 'ipc']
    });

    // The scraper worker sends structured progress messages, not just log lines
    this.scraperProcess.on('message', (msg: ScraperMessage) => {
      const win = BrowserWindow.getAllWindows()[0];
      win?.webContents.send('scraper:progress', msg);
      // msg looks like: { type: 'progress', found: 12, status: 'running' }
      //             or: { type: 'complete', found: 42, companies: [...] }
      //             or: { type: 'error', message: '...' }
    });

    this.scraperProcess.send({ type: 'start', input });
  }

  stopScraper() {
    this.scraperProcess?.kill('SIGTERM');
  }
}

export const supervisor = new SystemSupervisor();
```

### 5.4 Inside the scraper's own process

```ts
// main/integrations/scraper/scraperWorker.ts  (this file runs as a SEPARATE process, not inside main)
import { chromium } from 'playwright';

process.on('message', async (msg: { type: 'start'; input: DiscoveryInput }) => {
  if (msg.type !== 'start') return;

  const browser = await chromium.launch();
  const results: Company[] = [];

  // ...scraping logic, calling process.send() periodically...
  for (const company of discoveredSoFar) {
    results.push(company);
    process.send?.({ type: 'progress', found: results.length, status: 'running' });
  }

  await browser.close();

  // Once done, push results to the API directly from here — the scraper worker
  // uses the same api-client package, so results reach MongoDB immediately.
  await apiClient.companies.bulkCreate(results);

  process.send?.({ type: 'complete', found: results.length });
  process.exit(0);
});
```

Notice the scraper worker calls `apiClient` directly, from inside its own process — it doesn't need to hand results back to `main` first. This keeps `main` from becoming a bottleneck relaying large payloads between processes; `main` only relays small progress _events_, not the actual scraped data.

### 5.5 Showing live status in the UI

```tsx
// renderer/hooks/useScraperStatus.ts
import { useEffect, useState } from 'react';

export function useScraperStatus() {
  const [status, setStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
  const [found, setFound] = useState(0);

  useEffect(() => {
    window.api.system.onScraperProgress((msg) => {
      if (msg.type === 'progress') {
        setStatus('running');
        setFound(msg.found);
      }
      if (msg.type === 'complete') {
        setStatus('complete');
        setFound(msg.found);
      }
      if (msg.type === 'error') setStatus('error');
    });
  }, []);

  return { status, found };
}
```

```tsx
// renderer/screens/DiscoveryScreen.tsx
const { status, found } = useScraperStatus();

return (
  <div>
    <button onClick={runDiscovery} disabled={status === 'running'}>
      {status === 'running' ? 'Running…' : 'Run Discovery'}
    </button>
    {status === 'running' && <ProgressBar>{found} companies found…</ProgressBar>}
    {status === 'complete' && <Banner variant="success">Found {found} companies</Banner>}
  </div>
);
```

This is the same pattern used for the design system's status badges (Section 8.4 of the design system doc) — a colored dot/badge driven directly by this `status` state, no polling required.

---

## 6. Running Other Workers (Email Polling, Job Queue)

Same supervisor, same pattern, different child process per worker — this is why `main/system/supervisor.ts` manages a _map_ of workers, not just the one scraper:

```ts
type WorkerName = 'scraperWorker' | 'emailWorker' | 'jobWorker';

class SystemSupervisor {
  private workers = new Map<WorkerName, ChildProcess>();

  start(name: WorkerName, payload?: unknown) {
    const child = fork(this.workerEntryPath(name), []);
    this.workers.set(name, child);
    child.on('message', (msg) => this.broadcast(name, msg));
    child.on('exit', (code) => this.handleExit(name, code));
    if (payload) child.send({ type: 'start', payload });
  }

  startAll() {
    this.start('jobWorker');
    this.start('emailWorker');
    // scraperWorker is started on-demand from the Discovery screen, not with "start all",
    // since it's a user-initiated action with a specific query, not a background daemon
  }

  stopAll() {
    this.workers.forEach((child) => child.kill('SIGTERM'));
  }
}
```

- **`jobWorker`** — polls the API for scheduled tasks (e.g., "re-check email verification status every night") via `GET /api/v1/jobs/due`, and executes what comes back.
- **`emailWorker`** — polls IMAP for replies on a timer, then calls `apiClient.messages.create(...)` to record what it finds.
- **`scraperWorker`** — started explicitly by the Discovery screen (Section 5), not part of "start all."
- **`syncWorker`** — the one worker that's new in this revision. Runs on a short interval (e.g. every 30 seconds) and does exactly one job: read `main/cache`'s `pending_actions` table, retry each queued write against the API in order, and remove it once confirmed. This is the piece that makes Section 3.2's offline-write story actually work, rather than just being a design on paper.

```ts
// main/system/syncWorker.ts — runs inside its own child process, same pattern as the others
import { getPendingActions, removePendingAction } from '../cache/sync-queue';
import { apiClient } from '@leadforge/api-client';

setInterval(async () => {
  const pending = await getPendingActions();
  for (const action of pending) {
    try {
      await apiClient.dispatch(action.type, action.payload); // e.g. companies:create → POST /companies
      await removePendingAction(action.id);
      process.send?.({ type: 'synced', actionId: action.id });
    } catch {
      // leave it queued, try again next interval — don't let one failure block the others
      continue;
    }
  }
}, 30_000);
```

## 6.5 SQLite Schema — What Actually Lives Locally

```sql
-- main/cache/schema.ts (illustrative — actual table set grows per entity)
CREATE TABLE cached_companies (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,       -- the full DTO, stored as JSON
  cached_at INTEGER NOT NULL
);

CREATE TABLE pending_actions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,        -- e.g. 'companies:create'
  payload TEXT NOT NULL,     -- JSON
  created_at INTEGER NOT NULL,
  retry_count INTEGER DEFAULT 0,
  last_error TEXT
);
```

Two tables, not a schema mirror of MongoDB — `cached_*` tables are deliberately just "id + JSON blob," since they only need to answer "what did we last see," never to be queried richly (rich queries always go to the real API). `pending_actions` is the entire offline-write story in one small table.

## 7. The System Health / One-Click Panel

```tsx
// renderer/components/SystemHealthPanel.tsx
export function SystemHealthPanel() {
  const [statuses, setStatuses] = useState<Record<string, string>>({});

  useEffect(() => {
    window.api.system.onStatusChange(({ name, status }) =>
      setStatuses((s) => ({ ...s, [name]: status }))
    );
    window.api.system.status().then((initial) => {
      setStatuses(Object.fromEntries(initial.map((w) => [w.name, w.status])));
    });
  }, []);

  return (
    <div className="flex items-center gap-3">
      <button onClick={() => window.api.system.start()} className="btn-primary">
        Start System
      </button>
      {Object.entries(statuses).map(([name, status]) => (
        <StatusBadge key={name} label={name} status={status} />
        // uses the design system's semantic state colors — green/gray/red/yellow dot + label
      ))}
    </div>
  );
}
```

`app.on('before-quit', () => supervisor.stopAll())` in `main/index.ts` guarantees nothing is left running — this matters a lot for Playwright specifically, since an orphaned headless Chromium process silently burns battery/CPU if the app is closed mid-scrape.

---

## 8. Best Practices — The Rules That Keep This From Turning Into Spaghetti

1. **`apps/desktop` never imports Mongoose, ever.** If a file under `apps/desktop` imports `mongodb` or `mongoose`, that's a bug — no exceptions, not even "just for this one quick thing." All data access goes through `packages/api-client`.
2. **`apps/api/repositories` is the only place that queries Mongo.** Services call repositories; routes call services; nothing skips a layer.
3. **Every API response is a DTO, never a raw Mongo document.** Never return `_id`, internal-only fields, or anything Mongoose adds automatically — map explicitly in the route or a small mapper function.
4. **One Zod schema per entity, shared.** Define `CompanySchema` once in `packages/validation`, and use the _same_ schema to validate a form on desktop and a request body on the API. Two schemas for the same shape will eventually drift and disagree.
5. **`main/ipc/*.ts` and `apps/api/routes/*.ts` stay thin.** If an IPC handler or a route has more than ~10 lines of actual logic, that logic belongs in a service, not in the handler.
6. **The renderer never calls `fetch` directly.** All network activity happens in `main`, via `api-client`. This keeps JWTs out of the renderer entirely (see #7) and keeps request logic in one place.
7. **JWT/refresh tokens live only in `main`, via `safeStorage`, never in the renderer.** The renderer doesn't know or care that a token exists — it just calls `window.api.companies.list()` and gets data back.
8. **Every child process (scraper, workers) is spawned by the Supervisor, never spawned ad hoc from a service.** This keeps process lifecycle (start, crash-restart, graceful shutdown) centralized in one file instead of scattered.
9. **Long-running work sends progress via events (`webContents.send`), not via a hanging IPC `invoke`.** `invoke`/`handle` is request/response — it's the wrong tool for "tell me every 2 seconds how many companies you've found."
10. **Structured logging (Pino) everywhere, with a `correlationId` per request/job**, so a bug report ("company import failed") can be traced from the button click through the IPC call, through the API request, down to the repository query.
11. **Fail loud, fail visible — even when queued.** A write that gets queued into `pending_actions` (Section 3.2) must still show the user a clear "saved locally, will sync" indicator, not a silent success indistinguishable from a real save. A read falling back to cached data (Section 3.1) must show a small "offline / showing cached data" indicator too. The user should never be left guessing whether what they're looking at is current.
12. **The cache is disposable; treat it that way in code, not just in docs.** Nothing should ever assume `main/cache` contains data — every read from it must have a "cache miss" path, and it should be safe to delete the local `.sqlite` file at any time (e.g., during a fresh install) with no permanent data loss, only a slower first load.
13. **Environment config lives in one place per app** (`apps/desktop/.env`, `apps/api/.env`) and is validated at startup with Zod — fail immediately on a missing `MONGODB_URI` or `BETTER_AUTH_SECRET`, not three requests later with a cryptic error.

---

## 9. Local Development Workflow

```bash
# terminal 1 — API
cd apps/api && pnpm dev          # runs Hono locally, e.g. on localhost:8787

# terminal 2 — Desktop
cd apps/desktop && pnpm dev      # electron-vite dev, pointed at localhost:8787 via .env
```

`apps/desktop/.env.development` should point `API_BASE_URL` at `http://localhost:8787`; `.env.production` points at the deployed Vercel URL. This is the only difference between dev and prod for the desktop app — no other config should branch on environment.

---

## 10. Deployment

- **`apps/api`** → `git push` to the connected branch → Vercel builds and deploys automatically. No manual server management.
- **`apps/desktop`** → `electron-builder` produces installers → published to GitHub Releases → `electron-updater` (already configured) checks for and applies updates automatically on GTM's machine.

---

## 11. Reconciling `docs/arch/`

You have ~20 existing architecture files that were written under different assumptions (some assume standalone desktop + local Mongo, some assume Fastify, some assume SQLite). This document is the new canonical source. Recommended next step: skim each existing file, keep what still applies (design system, screen list, roadmap phases), and delete or clearly mark superseded anything that contradicts this doc (standalone-only architecture, Fastify-specific code samples, SQLite-as-source-of-truth language) — so there's exactly one current architectural truth, not twenty documents someone has to cross-reference.
