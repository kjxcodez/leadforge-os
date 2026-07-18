import Database from 'better-sqlite3';
import { join } from 'path';
import { randomUUID } from 'crypto';
import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import pLimit from 'p-limit';
import type { JobContext } from '../../../shared/types/job';

interface QueueItem {
  url: string;
  depth: number;
  priority: number;
}

/**
 * Scores a URL path to determine its crawl priority.
 */
function scoreUrlPriority(urlStr: string): number {
  try {
    const path = new URL(urlStr).pathname.toLowerCase();
    if (path.match(/\/(contact(-us)?|about|team)\/?$/)) return 10;
    if (path.match(/\/(staff|people|meet-the-team|leadership)\/?$/)) return 7;
    if (path === '/' || path === '') return 5;
    if (path.match(/\/(services|locations)\/?$/)) return 3;
  } catch {
    // Ignore invalid URL parse issues
  }
  return 1;
}

/**
 * Normalizes and extracts internal links matching the starting origin.
 */
function extractInternalLinks(html: string, currentUrl: string, origin: string): string[] {
  const links: string[] = [];
  try {
    const $ = cheerio.load(html);
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      try {
        const resolved = new URL(href, currentUrl);
        if (resolved.origin === origin) {
          // Normalize: remove hash anchors to avoid duplicate visits
          const clean = resolved.origin + resolved.pathname + resolved.search;
          links.push(clean);
        }
      } catch {
        // Skip invalid URL structures
      }
    });
  } catch {
    // Return empty on Cheerio errors
  }
  return links;
}

/**
 * Simple email validation.
 */
function validateEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Filters out standard noise email domains and patterns.
 */
function isNoiseEmail(email: string): boolean {
  const blockedDomains = ['sentry.io', 'example.com', 'yourdomain.com', 'wix.com', 'wordpress.org'];
  const blockedPatterns = [/noreply/, /donotreply/, /webmaster/, /postmaster/, /support/, /admin/];
  const domain = email.split('@')[1] || '';
  if (blockedDomains.includes(domain)) return true;
  return blockedPatterns.some(p => p.test(email));
}

/**
 * Classifies harvested emails into categories.
 */
function classifyEmail(email: string): { type: 'human' | 'department' | 'unknown'; confidence: 'high' | 'medium' | 'low' } {
  const prefix = (email.split('@')[0] || '').toLowerCase();
  const departmentPrefixes = [
    'info', 'hello', 'contact', 'support', 'sales', 'careers', 'jobs', 'billing', 'admin',
    'office', 'team', 'general', 'marketing', 'press', 'media', 'help', 'service'
  ];
  if (departmentPrefixes.includes(prefix)) {
    return { type: 'department', confidence: 'medium' };
  }
  if (prefix.includes('.') || prefix.includes('_') || (prefix.length > 3 && prefix.length < 15)) {
    return { type: 'human', confidence: 'high' };
  }
  return { type: 'unknown', confidence: 'low' };
}

/**
 * Website Crawler Worker Plugin.
 * Crawls target company websites recursively using Cheerio and stores contact records.
 */
export async function crawlWebsite(ctx: JobContext): Promise<any> {
  const companyId = ctx.payload.companyId as string;
  const website = String(ctx.payload.website || '');
  const maxDepth = ctx.payload.maxDepth !== undefined ? Number(ctx.payload.maxDepth) : 3;
  const maxPages = ctx.payload.maxPages !== undefined ? Number(ctx.payload.maxPages) : 50;

  ctx.emitLog(`Initializing Website Crawler plugin. Company: "${companyId}" | Target: ${website}`, 'info');

  if (!companyId || !website) {
    throw new Error('companyId and website payload parameters are required.');
  }

  const dbDir = process.env.WORKSPACES_DB_DIR || '';
  if (!dbDir) {
    throw new Error('WORKSPACES_DB_DIR env variable is required for background workers.');
  }

  const dbPath = join(dbDir, `leadforge_${ctx.workspaceId}.db`);
  ctx.emitLog(`Opening database connection at: ${dbPath}`, 'info');
  const db = new Database(dbPath);

  // Set company crawlStatus to in_progress
  db.prepare(`
    UPDATE companies
    SET crawlStatus = 'in_progress', updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(companyId);

  // Restore state from checkpoint if resuming
  const checkpoint = ctx.getCheckpoint();
  const visitedUrls = new Set<string>();
  let queue: QueueItem[] = [];
  let currentDepth = 0;
  let pagesCrawled = 0;
  const contactsFound = new Set<string>();

  if (checkpoint) {
    checkpoint.visitedUrls?.forEach((u: string) => visitedUrls.add(u));
    queue = checkpoint.queue || [];
    currentDepth = checkpoint.currentDepth || 0;
    pagesCrawled = visitedUrls.size;
    ctx.emitLog(`Resuming crawler from checkpoint. Visited URLs: ${visitedUrls.size} | Queue depth: ${queue.length}`, 'info');
  } else {
    // Start fresh: queue the homepage
    queue.push({ url: website, depth: 0, priority: 5 });
  }

  const origin = new URL(website).origin;
  const userAgent = 'LeadForgeBot/1.0 (+https://leadforge.ai/bot)';
  let robots: any = null;

  try {
    // 1. Fetch robots.txt
    ctx.emitLog(`Checking robots.txt availability for: ${origin}`, 'info');
    try {
      const robotsUrl = `${origin}/robots.txt`;
      const robotsRes = await fetch(robotsUrl, {
        headers: { 'User-Agent': userAgent },
        signal: AbortSignal.timeout(5000)
      });
      if (robotsRes.ok) {
        const text = await robotsRes.text();
        robots = robotsParser(robotsUrl, text);
        ctx.emitLog('Successfully loaded and parsed robots.txt file.', 'info');
      } else {
        ctx.emitLog(`No robots.txt found (HTTP ${robotsRes.status}). Proceeding with defaults.`, 'info');
      }
    } catch (robotsErr: any) {
      ctx.emitLog(`robots.txt check failed: ${robotsErr.message || robotsErr}. Proceeding with crawl.`, 'info');
    }

    const limit = pLimit(3); // Max concurrency: 3 concurrent requests

    // 2. BFS Crawling loop
    while (queue.length > 0 && pagesCrawled < maxPages) {
      if (ctx.isCancelled()) {
        ctx.emitLog('Crawler execution cancelled by scheduler.', 'warn');
        throw new Error('Job cancelled.');
      }
      if (ctx.isPaused()) {
        ctx.emitLog('Crawler execution paused. Saving checkpoint.', 'warn');
        ctx.saveCheckpoint({ visitedUrls: Array.from(visitedUrls), queue, currentDepth });
        throw new Error('Job paused.');
      }

      // Dequeue batch of URLs to process concurrently
      const batchSize = Math.min(queue.length, 3, maxPages - pagesCrawled);
      const batch: QueueItem[] = [];
      for (let i = 0; i < batchSize; i++) {
        batch.push(queue.shift()!);
      }

      const tasks = batch.map(item => limit(async () => {
        if (visitedUrls.has(item.url)) return;
        visitedUrls.add(item.url);

        // Respect robots.txt exclusion rules
        if (robots && !robots.isAllowed(item.url, 'LeadForgeBot/1.0')) {
          ctx.emitLog(`Url disallowed by robots.txt: ${item.url}`, 'info');
          return;
        }

        try {
          ctx.emitLog(`Crawling URL: ${item.url} (Depth: ${item.depth})`, 'info');
          const res = await fetch(item.url, {
            headers: { 'User-Agent': userAgent },
            signal: AbortSignal.timeout(10000)
          });

          if (!res.ok) {
            ctx.emitLog(`Failed to fetch page ${item.url} (HTTP ${res.status})`, 'warn');
            return;
          }

          const contentType = res.headers.get('content-type') || '';
          if (!contentType.includes('text/html')) {
            ctx.emitLog(`Skipping non-HTML content-type: ${contentType} on ${item.url}`, 'info');
            return;
          }

          const html = await res.text();
          pagesCrawled++;

          // Extract contacts from HTML content
          const $ = cheerio.load(html);
          const pageEmails = new Set<string>();

          // Extract mailto links
          $('a[href^="mailto:"]').each((_, el) => {
            if (el) {
              const href = $(el).attr('href');
              if (href) {
                const parts = href.replace(/^mailto:/i, '').split('?');
                const mailPart = parts[0];
                if (mailPart) {
                  const mail = mailPart.trim();
                  if (mail) pageEmails.add(mail.toLowerCase());
                }
              }
            }
          });

          // Extract via RegEx
          const bodyText = $('body').text() || '';
          const matches = bodyText.match(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g);
          if (matches) {
            matches.forEach(m => pageEmails.add(m.toLowerCase()));
          }

          // Extract phone numbers
          const pagePhones = new Set<string>();
          $('a[href^="tel:"]').each((_, el) => {
            if (el) {
              const href = $(el).attr('href');
              if (href) {
                const parts = href.replace(/^tel:/i, '').split('?');
                const phonePart = parts[0];
                if (phonePart) {
                  const phone = phonePart.trim();
                  if (phone) pagePhones.add(phone);
                }
              }
            }
          });

          const bodyPhones = bodyText.match(/(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})\b/g);
          if (bodyPhones) {
            bodyPhones.forEach(p => pagePhones.add(p.trim()));
          }

          const extractedPhone = pagePhones.size > 0 ? Array.from(pagePhones)[0] : null;

          // Insert unique contacts inside database transaction
          for (const email of pageEmails) {
            if (!validateEmailFormat(email) || isNoiseEmail(email)) continue;
            if (contactsFound.has(email)) continue;
            contactsFound.add(email);

            // Check SQLite duplicate check (email must be unique per workspace)
            const duplicate = db.prepare('SELECT id FROM contacts WHERE workspaceId = ? AND email = ?').get(ctx.workspaceId, email);
            if (duplicate) {
              ctx.emitLog(`Skipped duplicate workspace contact: ${email}`, 'info');
              continue;
            }

            const { type, confidence } = classifyEmail(email);

            db.transaction(() => {
              const contactId = randomUUID();
              db.prepare(`
                INSERT INTO contacts (id, workspaceId, companyId, email, phone, confidence, verificationStatus, sourceUrl, sourcePlatform, priority, type, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, 'unverified', ?, 'web', 1, ?, datetime('now'), datetime('now'))
              `).run(contactId, ctx.workspaceId, companyId, email, extractedPhone, confidence, item.url, type);

              db.prepare(`
                INSERT INTO sync_queue (id, workspaceId, entityType, entityId, operation, payload, version, retryCount, lastError, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, 'CREATE', ?, 1, 0, NULL, datetime('now'), datetime('now'))
              `).run(
                randomUUID(),
                ctx.workspaceId,
                'contacts',
                contactId,
                'CREATE',
                JSON.stringify({ id: contactId, workspaceId: ctx.workspaceId, companyId, email, phone: extractedPhone, status: 'UNVERIFIED' })
              );
            })();

            ctx.emitLog(`Stored harvested contact email: ${email}`, 'info');
          }

          // Enqueue nested internal links if depth limit is not reached
          if (item.depth < maxDepth) {
            const rawLinks = extractInternalLinks(html, item.url, origin);
            for (const link of rawLinks) {
              if (!visitedUrls.has(link)) {
                const prio = scoreUrlPriority(link);
                queue.push({ url: link, depth: item.depth + 1, priority: prio });
              }
            }
            // Maintain priority and depth BFS order
            queue.sort((a, b) => b.priority - a.priority || a.depth - b.depth);
          }

          // Report progress
          const progress = Math.round((pagesCrawled / maxPages) * 100);
          ctx.updateProgress(progress, {
            current: pagesCrawled,
            total: maxPages,
            entity: item.url,
            description: `Extracted ${contactsFound.size} contacts`
          });

          // Autosave checkpoint every 5 pages
          if (pagesCrawled % 5 === 0) {
            ctx.saveCheckpoint({ visitedUrls: Array.from(visitedUrls), queue, currentDepth: item.depth });
            ctx.emitLog(`Autosaved checkpoint at count ${pagesCrawled}.`, 'info');
          }

        } catch (pageErr: any) {
          ctx.emitLog(`Failed to process crawl page ${item.url}: ${pageErr.message || pageErr}`, 'error');
        }
      }));

      await Promise.all(tasks);
    }

    // 3. Update company completion details
    if (pagesCrawled === 0) {
      // Entire website was unreachable (homepage failed or redirected to error)
      db.prepare(`
        UPDATE companies
        SET crawlStatus = 'failed', crawlError = 'Root URL resolved, but no pages could be crawled.', crawledAt = datetime('now'), updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(companyId);
      ctx.emitLog(`Crawl failed: Homepage resolved, but no content could be retrieved.`, 'warn');
    } else {
      db.prepare(`
        UPDATE companies
        SET crawlStatus = 'completed', contactCount = ?, crawlError = NULL, crawledAt = datetime('now'), updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(contactsFound.size, companyId);
      ctx.emitLog(`Crawl completed successfully. Processed pages: ${pagesCrawled} | Contacts found: ${contactsFound.size}`, 'info');
    }

  } catch (err: any) {
    // If paused/cancelled throws, worker-host exits cleanly. Otherwise, standard failure
    if (err.message !== 'Job paused.' && err.message !== 'Job cancelled.') {
      db.prepare(`
        UPDATE companies
        SET crawlStatus = 'failed', crawlError = ?, crawledAt = datetime('now'), updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(err.message || err, companyId);
      throw err;
    }
    throw err;
  } finally {
    db.close();
  }

  return { pagesCrawled, contactsFound: contactsFound.size };
}
