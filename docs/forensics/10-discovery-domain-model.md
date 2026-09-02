# Phase 1 Forensic Document 10 — Discovery Domain Model & Job Classification

**Document Type:** Forensic Domain Model Analysis  
**Audited Against:** `DiscoveryScreen.tsx`, `JobModel`, `DiscoveryRunModel`, `CompanyDiscoveryRunModel`  
**Date:** September 2026  
**Status:** Authoritative Baseline  

---

## 1. Discovery Domain Entities vs Generic Jobs

The LeadForge architecture contains two distinct layers that were conflated in the renderer UI:

```
┌─────────────────────────────────────────────────────────────┐
│                 Canonical Domain Entities                   │
│                                                             │
│   DiscoveryRun (MongoDB: discovery_runs)                    │
│   ├── id: UUID                                              │
│   ├── query, country, state, city                           │
│   ├── status: 'pending' | 'running' | 'completed' | 'failed'│
│   └── resultCount: number                                   │
│                                                             │
│   CompanyDiscoveryRun (MongoDB: company_discovery_runs)     │
│   ├── id: UUID                                              │
│   ├── discoveryRunId: string                                │
│   └── companyId: string                                     │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼ (Dispatches)
┌─────────────────────────────────────────────────────────────┐
│                 Scheduler Job Queue Layer                   │
│                                                             │
│   Job (MongoDB: jobs)                                       │
│   ├── id: UUID                                              │
│   ├── type: 'scraper:maps'                                  │
│   │         'crawler:website'                               │
│   │         'enrich:website'                                │
│   │         'enrich:linkedin'                               │
│   │         'enrich:intelligence'                           │
│   │         'automation:workflow'                           │
│   │         'outreach:campaign'                             │
│   ├── payload: { discoveryRunId, ... }                      │
│   ├── status: 'queued'|'starting'|'running'|'completed'     │
│   └── workerId: string                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Why Discovery UI Displayed `enrich:intelligence` and `automation:workflow`

### Forensic Code Evidence:
In [`apps/desktop/src/renderer/screens/DiscoveryScreen.tsx:311-333`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/DiscoveryScreen.tsx#L311-L333):

```typescript
// 2. Add orphan parent jobs as standalone runs so no jobs are hidden
allJobs.forEach((job) => {
  if (job.type === 'crawler:website') return;
  const p = safeParsePayload(job.payload);
  const runId = p.discoveryRunId;
  if (runId && runMap.has(runId)) return;

  const id = runId || job.id;
  if (!runMap.has(id)) {
    runMap.set(id, {
      id,
      name: p.name || job.type,
      query: p.query || job.type,
      location: [p.city, p.state, p.country].filter(Boolean).join(', '),
      status: job.status,
      progress: job.progress || 0,
      mapsJobId: job.id,
      linkedJobs: [job],
      createdAt: job.createdAt
    });
  }
});
```

### Explanation of Failure:
1. `DiscoveryScreen.tsx` queries `scheduler:jobs:list` (which returns ALL background jobs in the workspace).
2. It attempts to populate the discovery runs table by combining explicit `discovery_runs` records with an unconstrained loop over `allJobs`.
3. The filter ONLY excludes `crawler:website`.
4. Therefore, any other background job type (e.g. `enrich:intelligence`, `automation:workflow`, `enrich:linkedin`, `outreach:campaign`) is caught by the fallback loop and inserted into the UI table as a fake "Discovery Run" with title `enrich:intelligence` or `automation:workflow`.

---

## 3. Domain Model Verdict

1. **Backend Model is Canonical:** The Hono API exposes dedicated, typed endpoints for discovery runs:
   - `GET /api/v1/discovery-runs`
   - `POST /api/v1/discovery-runs`
   - `GET /api/v1/discovery-runs/:id/companies`
2. **UI Conflation Defect:** The UI was synthesizing discovery runs from generic job records rather than treating `discovery_runs` as the sole canonical collection and viewing jobs merely as execution tasks.
