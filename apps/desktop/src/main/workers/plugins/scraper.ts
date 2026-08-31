import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { JobContext } from '../../../shared/types/job';
import { normalizeStateName, normalizeCountryName } from '../../../shared/utils/locations';
import { SdkClient } from '@leadforge/sdk';
import { generateEntityId, CompanyStatus, ContactStatus } from '@leadforge/schema';
import { resolveWorkerApiUrl } from '../worker-host';

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
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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
    const text = await page
      .locator('div.F7nice span[aria-hidden="true"]')
      .first()
      .innerText({ timeout: 2000 })
      .catch(() => null);
    if (text) {
      const val = parseFloat(text.replace(',', '.'));
      if (!isNaN(val)) return val;
    }
    const aria = await page
      .locator('[aria-label*="stars"]')
      .first()
      .getAttribute('aria-label', { timeout: 2000 })
      .catch(() => null);
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
 * Normalizes a raw Google Maps address string.
 */
function normalizeLocation(raw: string | null): string | null {
  if (!raw) return null;
  const parts = raw.split('\u00B7');
  let address = (parts[0] || raw).trim();
  address = address.replace(/\b(Closed|Open|Opens|Closes|24\s*hours?)\b.*$/i, '').trim();
  address = address.replace(/[^\p{L}\p{N}\s,\.\-\/()#&']/gu, '').trim();
  address = address.replace(/\s{2,}/g, ' ').trim();
  return address.length > 0 ? address : null;
}

/**
 * Normalizes telephone numbers by stripping visual separators.
 */
function normalizePhone(raw: string | null): string | null {
  if (!raw) return null;
  let clean = raw.replace(/[\s\-\(\)\.]/g, '');
  if (/^\d{10}$/.test(clean)) {
    clean = `+1${clean}`;
  } else if (/^\d{11}$/.test(clean) && clean.startsWith('1')) {
    clean = `+${clean}`;
  } else if (/^[^\+]\d+$/.test(clean)) {
    clean = `+${clean}`;
  }
  return clean.length > 0 ? clean : null;
}

/**
 * Google Maps Scraper Job Plugin (Phase 7 - API/MongoDB-First).
 * Queries Google Maps listings using Playwright and persists directly via SdkClient.
 */
export async function scrapeMaps(ctx: JobContext): Promise<any> {
  const rawQuery = ctx.payload.query || '';
  const country = ctx.payload.country;
  const state = ctx.payload.state;
  const city = ctx.payload.city;
  const discoveryRunId = ctx.payload.discoveryRunId;

  const locParts = [city, state, country].filter(Boolean);
  let effectiveQuery = rawQuery;
  if (locParts.length > 0 && !rawQuery.toLowerCase().includes(locParts[0].toLowerCase())) {
    effectiveQuery = `${rawQuery} in ${locParts.join(', ')}`;
  }

  const maxResults =
    ctx.payload.maxResults !== undefined
      ? Number(ctx.payload.maxResults)
      : ctx.payload.limit !== undefined
        ? Number(ctx.payload.limit)
        : 100;

  ctx.emitLog(
    `Initializing Google Maps Playwright scraper. Query: "${effectiveQuery}" | Limit: ${maxResults}`,
    'info'
  );

  // Initialize SdkClient for authoritative API/MongoDB persistence
  const apiUrl = resolveWorkerApiUrl(ctx);
  const authToken = ctx.payload._secrets?.sessionToken || process.env.LEADFORGE_API_TOKEN || '';
  const sdk = new SdkClient({
    baseUrl: apiUrl,
    token: authToken,
    headers: {
      'x-workspace-id': ctx.workspaceId
    }
  });

  let collectedCount = 0;
  let storedCount = 0;
  let skippedCount = 0;
  let duplicatesCount = 0;

  let browser: Browser | null = null;
  let browserCtx: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    ctx.updateProgress(5, { description: 'Launching browser...' });
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });

    browserCtx = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US'
    });

    page = await browserCtx.newPage();

    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(effectiveQuery)}`;
    ctx.emitLog(`Navigating to Google Maps search: ${searchUrl}`, 'info');
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Handle cookie banners if present
    try {
      const consentBtn = page.locator('button[aria-label*="Accept all"], button[aria-label*="Agree"]').first();
      if (await consentBtn.isVisible({ timeout: 3000 })) {
        await consentBtn.click();
      }
    } catch {}

    const feedLocator = page.locator('div[role="feed"]');
    const hasFeed = await feedLocator.isVisible({ timeout: 10000 }).catch(() => false);

    if (!hasFeed) {
      // Single listing or direct result
      const isSingleListing = await page.locator('h1').first().isVisible({ timeout: 3000 }).catch(() => false);
      if (isSingleListing) {
        await scrapeDetailsAndStore(page.url(), page, sdk, ctx);
      } else {
        ctx.emitLog('No Google Maps search feed or listing found for query.', 'warn');
      }
    } else {
      // Scroll feed and extract items
      const seenUrls = new Set<string>();
      let scrollAttempts = 0;
      const MAX_SCROLL_ATTEMPTS = 50;

      while (seenUrls.size < maxResults && scrollAttempts < MAX_SCROLL_ATTEMPTS) {
        if (ctx.isCancelled()) {
          ctx.emitLog('Scraper received cancellation signal. Terminating.', 'warn');
          break;
        }

        const anchors = await page.locator('div[role="feed"] a[href*="/maps/place/"]').all();
        for (const anchor of anchors) {
          if (seenUrls.size >= maxResults) break;
          const href = await anchor.getAttribute('href').catch(() => null);
          if (href && !seenUrls.has(href)) {
            seenUrls.add(href);
          }
        }

        collectedCount = seenUrls.size;
        ctx.updateProgress(Math.min(10 + Math.round((collectedCount / maxResults) * 40), 50), {
          description: `Collecting URLs: ${collectedCount} found`,
          current: collectedCount,
          total: maxResults
        });

        // Scroll feed down
        await feedLocator.evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        }).catch(() => {});

        await page.waitForTimeout(1000);
        scrollAttempts++;
      }

      ctx.emitLog(`Found ${seenUrls.size} listings to scrape. Beginning detail extraction.`, 'info');

      // Scrape detail pages
      const urlList = Array.from(seenUrls);
      for (let i = 0; i < urlList.length; i++) {
        if (ctx.isCancelled()) {
          ctx.emitLog('Scraper received cancellation signal during detail extraction.', 'warn');
          break;
        }

        const placeUrl = urlList[i];
        if (!placeUrl) continue;
        try {
          await scrapeDetailsAndStore(placeUrl, page, sdk, ctx);
        } catch (err: any) {
          ctx.emitLog(`Failed to extract listing details (${placeUrl}): ${err?.message || err}`, 'warn');
          skippedCount++;
        }

        const progressPercent = 50 + Math.round(((i + 1) / urlList.length) * 45);
        ctx.updateProgress(progressPercent, {
          description: `Extracting details (${i + 1}/${urlList.length})`,
          current: i + 1,
          total: urlList.length
        });

        ctx.saveCheckpoint({
          lastProcessedIndex: i,
          storedCount,
          duplicatesCount
        });
      }
    }

    ctx.updateProgress(100, { description: `Scrape completed: ${storedCount} stored` });
    ctx.emitLog(`Google Maps scraper finished. Stored: ${storedCount} | Duplicates: ${duplicatesCount}`, 'info');
  } catch (err: any) {
    ctx.emitLog(`Google Maps scraper encounter fatal error: ${err?.message || err}`, 'error');
    throw err;
  } finally {
    if (page) await page.close().catch(() => {});
    if (browserCtx) await browserCtx.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }

  // Helper function to extract and persist company & contact directly via API/MongoDB
  async function scrapeDetailsAndStore(
    url: string,
    page: Page,
    sdk: SdkClient,
    ctx: JobContext
  ) {
    ctx.emitLog(`Opening listing details: ${url}`, 'info');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const name = (
      await page
        .locator('h1')
        .first()
        .innerText({ timeout: 5000 })
        .catch(() => '')
    ).trim();

    if (!name) {
      ctx.emitLog('Skipped listing: Failed to retrieve business name.', 'warn');
      return;
    }

    let website = await page
      .locator('a[data-item-id="authority"]')
      .first()
      .getAttribute('href', { timeout: 2000 })
      .catch(() => null);

    const rawPhone = await page
      .locator('[data-item-id^="phone:tel:"]')
      .first()
      .getAttribute('data-item-id', { timeout: 2000 })
      .then((id) => (id ? id.replace('phone:tel:', '').trim() : null))
      .catch(() => null);

    const phone = normalizePhone(rawPhone);
    const rawLocation = await page
      .locator('[data-item-id="address"]')
      .first()
      .innerText({ timeout: 2000 })
      .catch(() => null);

    const location = normalizeLocation(rawLocation);
    const rating = await extractRating(page);

    if (website) {
      website = await resolveRedirect(website);
    }

    const domain = website ? extractDomain(website) : null;

    let companyCity: string | null = city || null;
    let companyState: string | null = state || null;
    let companyCountry: string | null = country || null;

    if (location && (!companyCity || !companyState || !companyCountry)) {
      const tokens = location.split(',').map((t) => t.trim());
      if (tokens.length >= 2) {
        const lastToken = tokens[tokens.length - 1] || '';
        const secondLastToken = tokens[tokens.length - 2] || '';

        if (!companyCountry && lastToken) {
          const detectedCountry = normalizeCountryName(lastToken);
          if (detectedCountry) companyCountry = detectedCountry;
        }

        const stateZipMatch = secondLastToken.match(/^([A-Z]{2})\s*(\d{5})?/i);
        if (stateZipMatch && stateZipMatch[1]) {
          if (!companyState) companyState = stateZipMatch[1].toUpperCase();
          if (!companyCity && tokens.length >= 3) {
            companyCity = tokens[tokens.length - 3] || null;
          }
        } else {
          const possibleRegion = normalizeStateName(secondLastToken, companyCountry || undefined);
          if (possibleRegion && possibleRegion !== secondLastToken) {
            if (!companyState) companyState = possibleRegion;
            if (!companyCity && tokens.length >= 3) {
              companyCity = tokens[tokens.length - 3] || null;
            }
          } else if (!companyCity) {
            companyCity = secondLastToken;
          }
        }
      }
    }

    if (companyCountry) {
      companyCountry = normalizeCountryName(companyCountry);
    }
    if (companyState) {
      companyState = normalizeStateName(companyState, companyCountry || undefined);
    }

    // Persist company authoritatively via SdkClient -> API -> MongoDB
    const companyId = generateEntityId();
    const loc = [companyCity, companyState, companyCountry].filter(Boolean).join(', ') || location || undefined;
    const createdCompany = await sdk.companies.create({
      id: companyId,
      name,
      domain: domain || undefined,
      location: loc,
      status: CompanyStatus.LEAD
    });

    storedCount++;
    ctx.emitLog(
      `Persisted company via API: "${name}" (${createdCompany.id}) | Domain: ${domain || 'N/A'} | Phone: ${phone || 'N/A'}`,
      'info'
    );

    // Auto-create primary contact if phone is available
    if (phone) {
      try {
        const contactId = generateEntityId();
        await sdk.contacts.create({
          id: contactId,
          companyId: createdCompany.id,
          firstName: name,
          phone,
          status: ContactStatus.NEW
        });
      } catch (contactErr) {
        ctx.emitLog(`Failed to create contact for company ${createdCompany.id}: ${contactErr}`, 'warn');
      }
    }

    // Link discovery run if requested
    if (discoveryRunId) {
      try {
        await sdk.companyDiscoveryRuns.create({
          id: generateEntityId(),
          workspaceId: ctx.workspaceId,
          companyId: createdCompany.id,
          discoveryRunId
        });
      } catch {}
    }
  }

  return { storedCount, skippedCount, duplicatesCount };
}
