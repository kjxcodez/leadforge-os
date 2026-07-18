import Database from 'better-sqlite3';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { JobContext } from '../../../shared/types/job';

/**
 * Resolves link shorteners and redirectors (e.g. t.co, bit.ly) to find the destination URL.
 */
async function resolveRedirect(urlStr: string): Promise<string> {
  const redirectors = ['t.co', 'bit.ly', 'tinyurl.com', 'linktr.ee', 'goo.gl', 'ow.ly'];
  try {
    const urlObj = new URL(urlStr);
    const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, '');
    if (redirectors.includes(hostname)) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(urlStr, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      clearTimeout(timeout);
      return res.url;
    }
  } catch (err) {
    // Return original URL if redirect resolution fails
  }
  return urlStr;
}

/**
 * Extracts base domain (e.g. example.com) from a website URL.
 */
function extractDomain(urlStr: string): string | null {
  try {
    if (!urlStr) return null;
    const urlObj = new URL(urlStr);
    let hostname = urlObj.hostname.toLowerCase();
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    return hostname;
  } catch {
    return null;
  }
}

/**
 * Extracts rating from the business details page.
 */
async function extractRating(page: Page): Promise<number | null> {
  try {
    const text = await page.locator('div.F7nice span[aria-hidden="true"]').first().innerText({ timeout: 2000 }).catch(() => null);
    if (text) {
      const val = parseFloat(text.replace(',', '.'));
      if (!isNaN(val)) return val;
    }
    const aria = await page.locator('[aria-label*="stars"]').first().getAttribute('aria-label', { timeout: 2000 }).catch(() => null);
    if (aria) {
      const match = aria.match(/([0-9.,]+)\s*stars/i);
      if (match && match[1]) {
        const val = parseFloat(match[1].replace(',', '.'));
        if (!isNaN(val)) return val;
      }
    }
  } catch {
    // Ignore rating errors
  }
  return null;
}

/**
 * Google Maps Scraper Job Plugin.
 * Queries maps listings using Playwright and populates the companies SQLite table.
 */
export async function scrapeMaps(ctx: JobContext): Promise<any> {
  const query = ctx.payload.query || '';
  const maxResults = ctx.payload.maxResults !== undefined
    ? Number(ctx.payload.maxResults)
    : (ctx.payload.limit !== undefined ? Number(ctx.payload.limit) : 10);
  
  ctx.emitLog(`Initializing Google Maps Playwright scraper. Query: "${query}" | Limit: ${maxResults}`, 'info');

  const dbDir = process.env.WORKSPACES_DB_DIR || '';
  if (!dbDir) {
    throw new Error('WORKSPACES_DB_DIR env variable is required for background workers.');
  }

  const dbPath = join(dbDir, `leadforge_${ctx.workspaceId}.db`);
  ctx.emitLog(`Opening database connection at: ${dbPath}`, 'info');
  const db = new Database(dbPath);

  // Restore state from checkpoint if resuming
  const checkpoint = ctx.getCheckpoint();
  let collectedCount = 0;
  let lastScrollPosition = 0;
  if (checkpoint) {
    collectedCount = checkpoint.collectedCount || 0;
    lastScrollPosition = checkpoint.lastScrollPosition || 0;
    ctx.emitLog(`Resuming scraper from checkpoint. Collected count: ${collectedCount} | Scroll offset: ${lastScrollPosition}px`, 'info');
  }

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let storedCount = 0;
  let skippedCount = 0;
  let duplicatesCount = 0;

  try {
    ctx.emitLog('Launching headless Chromium browser', 'info');
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
    });

    const page = await context.newPage();
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    
    ctx.emitLog(`Navigating to Google Maps search page: ${searchUrl}`, 'info');
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const feedSelector = 'div[role="feed"]';
    
    // Check if directly redirected to a details page (e.g. single match query)
    if (page.url().includes('/maps/place/')) {
      ctx.emitLog('Query matched exactly one listing, directly scraping detail page.', 'info');
      await scrapeDetailsAndStore(page.url(), page, db, ctx);
      return { storedCount: 1, skippedCount: 0, duplicatesCount: 0 };
    }

    // Otherwise scroll to collect links
    ctx.emitLog('Waiting for results feed to load...', 'info');
    await page.waitForSelector(feedSelector, { timeout: 15000 }).catch(() => {
      throw new Error(`Google Maps feed container ('${feedSelector}') was not found. Search may have returned no results.`);
    });

    if (lastScrollPosition > 0) {
      ctx.emitLog(`Restoring feed scroll offset to ${lastScrollPosition}px`, 'info');
      await page.evaluate(({ selector, pos }) => {
        const el = document.querySelector(selector);
        if (el) el.scrollTo(0, pos);
      }, { selector: feedSelector, pos: lastScrollPosition });
      await page.waitForTimeout(2000);
    }

    const listingSelector = 'a[href*="/maps/place/"]';
    const collectedUrls = new Set<string>();
    let isEnd = false;
    let consecutiveNoNewListings = 0;

    ctx.emitLog('Starting results infinite scroll loop...', 'info');
    while (collectedUrls.size < maxResults && !isEnd) {
      if (ctx.isCancelled()) {
        ctx.emitLog('Scraper execution cancelled during scroll loop.', 'warn');
        throw new Error('Job cancelled.');
      }
      if (ctx.isPaused()) {
        ctx.emitLog('Scraper execution paused during scroll loop. Saving checkpoint.', 'warn');
        const scrollPos = await page.evaluate(selector => {
          const el = document.querySelector(selector);
          return el ? el.scrollTop : 0;
        }, feedSelector);
        ctx.saveCheckpoint({ collectedCount, lastScrollPosition: scrollPos });
        throw new Error('Job paused.');
      }

      const prevSize = collectedUrls.size;
      const urls = await page.locator(listingSelector).evaluateAll(elements =>
        elements.map(el => el.getAttribute('href')).filter(Boolean) as string[]
      );

      for (const url of urls) {
        if (collectedUrls.size < maxResults) {
          collectedUrls.add(url);
        }
      }

      ctx.emitLog(`Listing links collected so far: ${collectedUrls.size}/${maxResults}`, 'info');

      if (collectedUrls.size >= maxResults) {
        break;
      }

      // Scroll down
      const feedElement = await page.$(feedSelector);
      if (feedElement) {
        const prevHeight = await page.evaluate(el => el.scrollHeight, feedElement);
        await page.evaluate(el => el.scrollTo(0, el.scrollHeight), feedElement);
        // Wait for network response/render delay
        await page.waitForTimeout(2000 + Math.random() * 1000);
        const newHeight = await page.evaluate(el => el.scrollHeight, feedElement);

        if (collectedUrls.size === prevSize) {
          consecutiveNoNewListings++;
        } else {
          consecutiveNoNewListings = 0;
        }

        // Stop if we hit the bottom of the feed or no new listings load repeatedly
        if (newHeight === prevHeight || consecutiveNoNewListings >= 5) {
          ctx.emitLog('Reached end of Google Maps results feed.', 'info');
          isEnd = true;
        }
      } else {
        isEnd = true;
      }
    }

    const linksArray = Array.from(collectedUrls);
    ctx.emitLog(`Completed scroll discovery phase. Total unique links found: ${linksArray.length}`, 'info');

    // Scrape details sequentially
    let index = 0;
    for (const url of linksArray) {
      if (index < collectedCount) {
        index++;
        continue;
      }

      if (ctx.isCancelled()) {
        ctx.emitLog('Scraper execution cancelled during details extraction.', 'warn');
        throw new Error('Job cancelled.');
      }
      if (ctx.isPaused()) {
        ctx.emitLog('Scraper execution paused during details extraction. Saving checkpoint.', 'warn');
        const scrollPos = await page.evaluate(selector => {
          const el = document.querySelector(selector);
          return el ? el.scrollTop : 0;
        }, feedSelector);
        ctx.saveCheckpoint({ collectedCount: index, lastScrollPosition: scrollPos });
        throw new Error('Job paused.');
      }

      try {
        const absoluteUrl = url.startsWith('http') ? url : `https://www.google.com${url}`;
        await scrapeDetailsAndStore(absoluteUrl, page, db, ctx);
      } catch (err: any) {
        ctx.emitLog(`Failed to extract details from listing ${index + 1}: ${err.message || err}`, 'error');
        // Continue to remaining listings
      }

      index++;
      collectedCount = index;

      // Save checkpoints every 10 listings
      if (collectedCount % 10 === 0) {
        const scrollPos = await page.evaluate(selector => {
          const el = document.querySelector(selector);
          return el ? el.scrollTop : 0;
        }, feedSelector);
        ctx.saveCheckpoint({ collectedCount, lastScrollPosition: scrollPos });
        ctx.emitLog(`Autosaved checkpoint at count ${collectedCount}.`, 'info');
      }

      const progress = Math.round((collectedCount / linksArray.length) * 100);
      ctx.updateProgress(progress, { current: collectedCount, total: linksArray.length });
    }

  } finally {
    ctx.emitLog('Shutting down Playwright browser contexts', 'info');
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    db.close();
  }

  return { storedCount, skippedCount, duplicatesCount };

  // Inner details scraper helper
  async function scrapeDetailsAndStore(url: string, page: Page, db: Database.Database, ctx: JobContext) {
    ctx.emitLog(`Opening listing details: ${url}`, 'info');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const name = await page.locator('h1').first().innerText({ timeout: 5000 }).catch(() => '');
    if (!name) {
      ctx.emitLog('Skipped listing: Failed to retrieve business name.', 'warn');
      return;
    }

    // Extract details via data-item-id
    let website = await page.locator('a[data-item-id="authority"]').first().getAttribute('href', { timeout: 2000 }).catch(() => null);
    const phone = await page.locator('[data-item-id^="phone:tel:"]').first().getAttribute('data-item-id', { timeout: 2000 })
      .then(id => id ? id.replace('phone:tel:', '').trim() : null)
      .catch(() => null);
    const location = await page.locator('[data-item-id="address"]').first().innerText({ timeout: 2000 }).catch(() => null);
    const rating = await extractRating(page);

    // Follow redirect for link shorteners
    if (website) {
      website = await resolveRedirect(website);
    }

    const domain = website ? extractDomain(website) : null;

    if (domain) {
      const duplicate = db.prepare('SELECT id FROM companies WHERE domain = ?').get(domain);
      if (duplicate) {
        duplicatesCount++;
        ctx.emitLog(`Skipped duplicate domain: "${domain}" (Company: "${name}")`, 'info');
        return;
      }
    }

    // Store in database in atomic transaction
    db.transaction(() => {
      const companyId = randomUUID();
      db.prepare(`
        INSERT INTO companies (id, workspaceId, name, domain, website, location, syncStatus, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
      `).run(companyId, ctx.workspaceId, name, domain || null, website || null, location || null);

      db.prepare(`
        INSERT INTO sync_queue (id, workspaceId, entityType, entityId, operation, payload, version, retryCount, lastError, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, 'CREATE', ?, 1, 0, NULL, datetime('now'), datetime('now'))
      `).run(
        randomUUID(),
        ctx.workspaceId,
        'companies',
        companyId,
        'CREATE',
        JSON.stringify({ id: companyId, workspaceId: ctx.workspaceId, name, domain, website, location, status: 'LEAD' })
      );

      storedCount++;
      ctx.emitLog(`Stored company: "${name}" | Website: ${website || 'N/A'} | Phone: ${phone || 'N/A'} | Rating: ${rating || 'N/A'}`, 'info');
    })();
  }
}
