# LeadForge OS — Scraping Pipeline Architecture Specification

> **Document Type**: Architecture Specification  
> **Phase**: 8 — Local Worker Runtime Audit  
> **Status**: Pre-Implementation Blueprint

---

## 1. Current State Assessment

### What Exists

The current `scraper.ts` plugin (`scraper:maps`) and `enricher.ts` plugin (`enrich:website`) are **high-fidelity simulations** — they generate plausible fake data, correctly use SQLite transactions, correctly propagate progress, and correctly handle cancellation. They are architecturally correct skeletons.

**No real scraping exists.** Neither Playwright nor Cheerio is currently imported anywhere in the desktop app. The old archive worker (`archives/lead-forge/apps/worker`) contains a real `WebsiteContactCrawler` backed by Cheerio and `p-limit`, but it targets MongoDB Atlas and cannot be used directly.

### Architecture Violation: API Contains Automation Logic

A critical violation is present in `apps/api/src/services/automation/automation.service.ts`:
- The API executes sequence steps including `SEND_EMAIL`
- The API calls `OutreachService.sendSingleEmail()` 
- The API contains WAIT step scheduling logic (`nextExecutionAt`)
- Execution is driven by the API's `process.nextTick()` recursion

**This violates the architecture principle**: the API must never be a job runner. Sequence execution must be migrated to the desktop worker runtime.

---

## 2. Pipeline Architecture

### 2.1 Complete Pipeline Flow

```
User Input (query, location, limit)
            │
            ▼
┌─────────────────────────────┐
│   Job: scraper:maps         │   Worker Plugin 1
│   Engine: Playwright        │   Concurrency: 1
│   Purpose: Discover URLs    │
└──────────────┬──────────────┘
               │ Companies written to SQLite
               │ Each company triggers→
               ▼
┌─────────────────────────────┐
│   Job: crawler:website      │   Worker Plugin 2
│   Engine: Cheerio + fetch   │   Concurrency: 2–3
│   Purpose: Crawl pages      │
│   Input: company.website    │
└──────────────┬──────────────┘
               │ Raw HTML + contact data to SQLite
               │
               ▼
┌─────────────────────────────┐
│   Job: enrich:website       │   Worker Plugin 3
│   Engine: Cheerio + regex   │   Concurrency: 3–5
│   Purpose: Extract contacts │
│   Validate emails           │
└──────────────┬──────────────┘
               │ Contacts written to SQLite
               │
               ▼
┌─────────────────────────────┐
│   Job: enrich:ai            │   Worker Plugin 4  [FUTURE]
│   Engine: OpenAI/Local LLM  │   Concurrency: 1–2
│   Purpose: AI enrichment    │
│   Scoring, summaries        │
└──────────────┬──────────────┘
               │ Enriched company/contact data
               │
               ▼
┌─────────────────────────────┐
│   Job: score:company        │   Worker Plugin 5  [FUTURE]
│   Engine: Rule-based        │   Concurrency: 5
│   Purpose: ICP scoring      │
└──────────────┬──────────────┘
               │ score written to company.score
               │
               ▼
┌─────────────────────────────┐
│   SQLite (local source)     │
│   sync_queue → SyncEngine   │
│   → MongoDB Atlas           │
└─────────────────────────────┘
```

---

## 3. Google Maps Discovery Worker

### 3.1 Design

**Engine**: Playwright (headless Chromium)  
**Job Type**: `scraper:maps`  
**Concurrency Limit**: 1 per workspace (browser resource constraint)  
**Resumable**: Yes — checkpoint stores `lastScrollPosition + collectedCount`

### 3.2 Why Playwright for Discovery

Google Maps is a JavaScript-rendered SPA. Static HTTP fetch returns no useful data. Playwright is the only viable option. Cheerio cannot be used here because:
- The listing results are loaded via XHR/Fetch, not in the initial HTML
- Infinite scroll requires real browser automation
- Rate limiting is enforced via user-agent and behavioral heuristics

### 3.3 Discovery Algorithm

```
1. Launch Playwright browser context (new context per job, not new browser)
2. Navigate to https://www.google.com/maps/search/{query}
3. Wait for results panel to load (selector: '[data-value="result_listing"]')
4. Begin scroll loop:
   a. Collect visible listings (name, website, phone, address, rating)
   b. Check ctx.isCancelled() after each listing
   c. Save checkpoint every 10 listings
   d. Scroll panel down
   e. Wait for new results to load (networkidle or 2s timeout)
   f. Repeat until: limit reached OR end of results
5. For each collected listing:
   a. CHECK duplicate: SELECT id FROM companies WHERE domain = ?
   b. If duplicate: skip + log + increment skippedCount
   c. Extract domain from website URL (handle t.co, bit.ly redirects)
   d. INSERT company + INSERT sync_queue in atomic transaction
   e. ctx.updateProgress(progress, { entity: companyName })
6. Close context (NOT browser — browser may be pooled)
7. Return { storedCount, skippedCount, duplicatesCount }
```

### 3.4 Browser Context Pooling

For multiple sequential scraping sessions, launching a browser per job is expensive (~1–3s overhead). The recommended approach:

```typescript
// main/lib/browser-pool.ts
class BrowserPool {
  private browser: Browser | null = null;
  private refCount = 0;
  
  async acquire(): Promise<BrowserContext> {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
    }
    this.refCount++;
    return this.browser.newContext({
      userAgent: randomUserAgent(),
      viewport: { width: 1280, height: 720 },
    });
  }
  
  async release(context: BrowserContext): Promise<void> {
    await context.close();
    this.refCount--;
    if (this.refCount === 0) {
      await this.browser?.close();
      this.browser = null;
    }
  }
}
```

The BrowserPool lives in the **worker process**, not Main. Each forked worker manages its own Playwright lifecycle. Do not share Playwright across worker processes.

### 3.5 Rate Limiting & Ethics

```typescript
interface GoogleMapsScraperConfig {
  requestDelayMs: number;        // min 1500ms between scrolls
  requestJitterMs: number;       // +/- 500ms random jitter
  maxConsecutiveErrors: number;  // abort after 5 consecutive errors
  maxDurationMs: number;         // kill after 15 minutes
  userAgentRotation: boolean;    // rotate UA per session
}
```

---

## 4. Website Crawler Worker

### 4.1 Design

**Engine**: Cheerio + node-fetch (no Playwright)  
**Job Type**: `crawler:website`  
**Concurrency Limit**: 2–3 per workspace  
**Resumable**: Yes — checkpoint stores visited URL set

### 4.2 Why Cheerio for Crawling (Not Playwright)

Website crawling (navigating page-by-page to find contacts) does **not** require JavaScript execution for most business websites. Cheerio + fetch is:
- 10–50x faster than Playwright per page
- Uses 95% less memory per concurrent session
- Sufficient for extracting emails, phones, team pages from static/SSR content

Playwright should only be used when:
- The site specifically requires JavaScript to render meaningful content
- The crawler detects an empty Cheerio result and falls back

The recommended approach: **Cheerio-first, Playwright-fallback per domain**:
```
fetch(url) → parse with Cheerio
if (pageIsEmpty || hasJsRedirect) → fallback to Playwright context
```

### 4.3 Crawl Algorithm

```
1. Initialize:
   - visitedUrls: Set<string>         (in-memory + checkpoint)
   - queue: Array<{url, priority}>    (BFS with priority ordering)
   - contacts: Map<email, ContactData>
   - depth: number = 0

2. Priority URL ordering (highest first):
   Priority 10: /contact, /contact-us, /about, /team
   Priority 7:  /staff, /people, /meet-the-team, /leadership
   Priority 5:  Homepage (/)
   Priority 3:  /services, /locations
   Priority 1:  All other internal links

3. Crawl loop (p-limit controlled concurrency = 3):
   a. Dequeue highest-priority URL
   b. Check visitedUrls (skip duplicates)
   c. Check robots.txt disallow rules
   d. fetch(url) with timeout 10s
   e. Parse with Cheerio:
      i.  Extract emails with regex (see §4.4)
      ii. Extract phone numbers
      iii.Extract contact names + titles (structured data)
      iv. Extract new internal links → enqueue with priority scoring
   f. Rate limit: wait requestDelayMs between requests
   g. Check ctx.isCancelled() after each page
   h. Save checkpoint every 5 pages

4. After crawl complete:
   a. Validate all emails (format + MX record check)
   b. Deduplicate emails across contacts
   c. Classify contacts (human vs department)
   d. Confidence scoring (see §4.5)
   e. Write contacts to SQLite
   f. Mark company.crawledAt, company.crawlStatus = 'completed'
```

### 4.4 Email Extraction Patterns

```typescript
const EMAIL_REGEX = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-z]{2,}\b/gi;

// Secondary extraction: href="mailto:..."
$('a[href^="mailto:"]').each((_, el) => {
  const email = $(el).attr('href')?.replace('mailto:', '').split('?')[0];
  if (email) emails.add(email.toLowerCase());
});

// Filter noise
const BLOCKED_DOMAINS = ['sentry.io', 'example.com', 'yourdomain.com'];
const BLOCKED_PATTERNS = [/noreply/, /donotreply/, /webmaster/, /postmaster/];
```

### 4.5 Contact Classification & Confidence Scoring

```typescript
interface CrawledContact {
  email: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  phone?: string;
  linkedinUrl?: string;
  type: 'human' | 'department' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  priority: number;
  sourceUrl: string;
  source: 'contact_page' | 'about_page' | 'footer' | 'body';
}

function scoreConfidence(contact: CrawledContact): 'high' | 'medium' | 'low' {
  if (contact.type === 'human' && contact.firstName && contact.lastName && contact.title) {
    return 'high';   // Named person with title — highest quality lead
  }
  if (contact.type === 'department') {
    return 'medium'; // info@, hello@, support@ — valid but not personalized
  }
  return 'low';      // Unknown pattern, likely noise
}
```

### 4.6 robots.txt Compliance

```typescript
const robotsCache = new Map<string, RobotsParser>();

async function canCrawl(baseUrl: string, targetUrl: string): Promise<boolean> {
  const origin = new URL(baseUrl).origin;
  if (!robotsCache.has(origin)) {
    const robots = await fetchRobots(`${origin}/robots.txt`);
    robotsCache.set(origin, robots);
  }
  return robotsCache.get(origin)!.isAllowed(targetUrl, 'LeadForgeBot/1.0');
}
```

### 4.7 Crawl Depth & Breadth Configuration

```typescript
interface CrawlerConfig {
  maxDepth: number;           // default: 3
  maxPages: number;           // default: 50
  maxConcurrency: number;     // default: 3 (p-limit)
  requestDelayMs: number;     // default: 500ms
  requestTimeoutMs: number;   // default: 10000ms
  userAgent: string;          // 'LeadForgeBot/1.0 (+https://leadforge.ai/bot)'
  respectRobotsTxt: boolean;  // default: true
  extractLinkedIn: boolean;   // default: true
  maxEmailsPerDomain: number; // default: 10 (cap noise)
}
```

---

## 5. Duplicate Detection Strategy

### 5.1 Companies (Before Insert)

```sql
-- Check by domain (primary deduplication key)
SELECT id FROM companies 
WHERE workspaceId = ? AND (domain = ? OR website = ?)
LIMIT 1;
```

Domain extraction must normalize URLs:
- Strip `https://`, `www.`, trailing slashes
- Handle `m.domain.com` → `domain.com`
- Handle international TLDs

### 5.2 Contacts (Before Insert)

```sql
-- Check by email (absolute unique key per workspace)
SELECT id FROM contacts 
WHERE workspaceId = ? AND email = ?
LIMIT 1;

-- Check for merge candidate (same name + company)
SELECT id FROM contacts
WHERE companyId = ? AND firstName = ? AND lastName = ?
LIMIT 1;
```

### 5.3 Deduplication Timing

Duplication check must occur **before persistence**, inside the same SQLite transaction:

```typescript
db.transaction(() => {
  const existing = db.prepare('SELECT id FROM contacts WHERE workspaceId = ? AND email = ?')
    .get(workspaceId, email);
  
  if (existing) {
    // Merge: add email as secondary, update missing fields
    mergeContact(existing.id, scraped);
  } else {
    // Create new contact
    insertContact(scraped);
    insertSyncQueue(contactId, 'CREATE');
  }
})();
```

---

## 6. Storage Schema Additions Required

```sql
-- Track crawl state per company
ALTER TABLE companies ADD COLUMN crawlStatus TEXT DEFAULT 'pending';
-- Values: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'

ALTER TABLE companies ADD COLUMN crawledAt DATETIME;
ALTER TABLE companies ADD COLUMN crawlError TEXT;
ALTER TABLE companies ADD COLUMN contactCount INTEGER DEFAULT 0;
ALTER TABLE companies ADD COLUMN score INTEGER;
ALTER TABLE companies ADD COLUMN scoreUpdatedAt DATETIME;

-- Raw contact discovery data
ALTER TABLE contacts ADD COLUMN confidence TEXT DEFAULT 'low';
-- Values: 'high' | 'medium' | 'low'

ALTER TABLE contacts ADD COLUMN type TEXT DEFAULT 'unknown';
-- Values: 'human' | 'department' | 'unknown'

ALTER TABLE contacts ADD COLUMN verificationStatus TEXT DEFAULT 'unverified';
-- Values: 'unverified' | 'valid' | 'invalid' | 'catch_all'

ALTER TABLE contacts ADD COLUMN sourceUrl TEXT;
ALTER TABLE contacts ADD COLUMN sourcePlatform TEXT;
ALTER TABLE contacts ADD COLUMN priority INTEGER DEFAULT 1;
```

---

## 7. Pipeline Trigger Strategy

### 7.1 Manual Trigger

User submits a search → IPC `scheduler:jobs:submit` with type `scraper:maps` and payload `{ query, limit }`.

### 7.2 Automatic Pipeline Chaining

After `scraper:maps` completes for a batch, the job result triggers the next stage:

```typescript
// In scheduler.ts handleJobSuccess():
if (job.type === 'scraper:maps') {
  // Auto-queue website crawl for newly discovered companies
  const newCompanies = db.prepare(`
    SELECT id FROM companies 
    WHERE workspaceId = ? AND crawlStatus = 'pending' AND website IS NOT NULL
    ORDER BY createdAt DESC LIMIT 50
  `).all(workspaceId);
  
  if (newCompanies.length > 0) {
    db.prepare(`INSERT INTO jobs (id, workspaceId, type, status, priority, payload, ...) VALUES (...)`)
      .run(uuid(), workspaceId, 'crawler:website', 'queued', 2, JSON.stringify({ companyIds: newCompanies.map(c=>c.id) }));
  }
}
```

### 7.3 Manual vs Automatic Toggle

Users must be able to control whether scraping triggers automatic crawling. This is a workspace setting:

```
settings.automation.autoEnrichAfterScrape = true | false
settings.automation.autoCrawlAfterScrape = true | false
settings.automation.autoScoreAfterEnrich = true | false
```
