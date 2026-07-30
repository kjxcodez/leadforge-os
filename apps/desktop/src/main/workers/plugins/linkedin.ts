import Database from 'better-sqlite3';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { JobContext } from '../../../shared/types/job';

/**
 * Validates a LinkedIn li_at cookie by making an auth check request.
 */
export async function validateLinkedInCookie(cookie: string): Promise<{ valid: boolean; message: string; csrfToken?: string }> {
  const cleanCookie = cookie.trim().replace(/^li_at=/i, '');
  if (!cleanCookie || cleanCookie.length < 20) {
    return { valid: false, message: 'Invalid cookie length' };
  }

  try {
    const res = await fetch('https://www.linkedin.com/feed/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cookie': `li_at=${cleanCookie}`,
      },
      redirect: 'manual',
    });

    if (res.status === 302 || res.status === 301) {
      const location = res.headers.get('location') || '';
      if (location.includes('login') || location.includes('authwall')) {
        return { valid: false, message: 'LinkedIn session expired or cookie invalid.' };
      }
    }

    // Extract JSESSIONID from Set-Cookie headers for CSRF
    const rawSetCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie') || ''];
    let csrfToken = '';
    for (const sc of rawSetCookies) {
      const match = sc.match(/JSESSIONID="?([^";]+)"?/);
      if (match && match[1]) {
        csrfToken = match[1];
        break;
      }
    }

    if (res.status === 200 || csrfToken) {
      return { valid: true, message: 'LinkedIn cookie active and valid.', csrfToken };
    }

    return { valid: false, message: `Unexpected response code: ${res.status}` };
  } catch (err: any) {
    return { valid: false, message: `Connection error: ${err.message || err}` };
  }
}

/**
 * Main worker plugin executor for enrich:linkedin jobs.
 */
export async function enrichLinkedIn(ctx: JobContext): Promise<any> {
  const companyId = ctx.payload.companyId;
  const companyName = ctx.payload.companyName || '';
  const domain = ctx.payload.domain || '';

  if (!companyId || !companyName) {
    throw new Error('companyId and companyName are required for LinkedIn enrichment.');
  }

  ctx.emitLog(`Initializing Executive LinkedIn Plugin for company "${companyName}" (${companyId})`, 'info');

  const dbDir = process.env.WORKSPACES_DB_DIR || '';
  if (!dbDir) {
    throw new Error('WORKSPACES_DB_DIR env variable is required for background workers.');
  }
  const dbPath = join(dbDir, `leadforge_${ctx.workspaceId}.db`);
  const db = new Database(dbPath);

  // 1. Get stored LinkedIn cookie from settings table, process.env, or payload secrets
  let cookie = ctx.payload._secrets?.['linkedin_li_at'] || process.env.LINKEDIN_COOKIE || '';
  if (!cookie) {
    const settingRow = db.prepare('SELECT value FROM settings WHERE workspaceId = ? AND key = ?').get(ctx.workspaceId, 'linkedin_li_at') as { value: string } | undefined;
    if (settingRow && settingRow.value) {
      cookie = settingRow.value;
    }
  }

  if (!cookie) {
    db.close();
    ctx.emitLog('No LinkedIn cookie (li_at) configured in Settings or LINKEDIN_COOKIE env var.', 'error');
    throw new Error('LinkedIn cookie not configured. Please add your li_at cookie in Settings > Integrations.');
  }

  const cleanCookie = cookie.trim().replace(/^li_at=/i, '');

  // 2. Validate session and extract CSRF token
  ctx.emitLog('Validating LinkedIn session credentials...', 'info');
  const authCheck = await validateLinkedInCookie(cleanCookie);
  if (!authCheck.valid) {
    db.close();
    ctx.emitLog(`LinkedIn session invalid: ${authCheck.message}`, 'error');
    throw new Error(`LinkedIn session invalid: ${authCheck.message}`);
  }

  const csrfToken = authCheck.csrfToken || 'ajax:0000000000000000000';

  ctx.updateProgress(20, { step: 1, current: 1, total: 3, description: `Searching LinkedIn profiles for ${companyName}` });

  // 3. Search decision makers on LinkedIn Voyager API
  const searchUrl = `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${encodeURIComponent(companyName)}`;

  let profilesFound: Array<{
    firstName: string;
    lastName: string;
    headline: string;
    publicIdentifier: string;
    pictureUrl?: string;
  }> = [];

  try {
    const searchRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cookie': `li_at=${cleanCookie}; JSESSIONID="${csrfToken}"`,
        'csrf-token': csrfToken,
        'Accept': 'application/vnd.linkedin.normalized+json+2.1',
        'x-li-lang': 'en_US',
        'x-restli-protocol-version': '2.0.0',
      },
    });

    if (searchRes.ok) {
      const data = await searchRes.json();
      const included = data.included || [];

      for (const item of included) {
        if (item.firstName || item.lastName) {
          const fn = (item.firstName || '').trim();
          const ln = (item.lastName || '').trim();
          const headline = item.headline || item.occupation || '';
          const publicId = item.publicIdentifier || item.objectUrn || '';

          if (fn || ln) {
            profilesFound.push({
              firstName: fn,
              lastName: ln,
              headline,
              publicIdentifier: publicId,
            });
          }
        }
      }
    }
  } catch (err: any) {
    ctx.emitLog(`LinkedIn Voyager query warning: ${err.message || err}`, 'warn');
  }

  // Fallback: If Voyager API endpoint returns limited items or is restricted, perform a targeted web query search
  if (profilesFound.length === 0) {
    ctx.emitLog(`Attempting web directory discovery for "${companyName}" executive team...`, 'info');
    try {
      const googleSearchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:linkedin.com/in "${companyName}" (CEO OR Founder OR President OR Owner OR Director OR VP)`)}`;
      const htmlRes = await fetch(googleSearchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (htmlRes.ok) {
        const text = await htmlRes.text();
        const matches = text.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/g);
        if (matches) {
          const uniqueIds = new Set<string>();
          for (const m of matches) {
            const id = m.replace('linkedin.com/in/', '').trim();
            if (id && !uniqueIds.has(id)) {
              uniqueIds.add(id);
              // Derive plausible name from public slug
              const parts = id.split('-');
              const fn = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : 'Executive';
              const ln = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : '';
              profilesFound.push({
                firstName: fn,
                lastName: ln,
                headline: `Decision Maker at ${companyName}`,
                publicIdentifier: id,
              });
            }
          }
        }
      }
    } catch (e: any) {
      ctx.emitLog(`Web search fallback error: ${e.message || e}`, 'warn');
    }
  }

  ctx.updateProgress(70, { step: 2, current: 2, total: 3, description: `Processing ${profilesFound.length} executive profiles` });

  let storedCount = 0;

  for (const prof of profilesFound) {
    if (ctx.isCancelled()) break;

    const linkedinUrl = prof.publicIdentifier.startsWith('http')
      ? prof.publicIdentifier
      : `https://www.linkedin.com/in/${prof.publicIdentifier}/`;

    // Deduplication check
    const existing = db.prepare(
      'SELECT id FROM contacts WHERE workspaceId = ? AND companyId = ? AND (linkedinUrl = ? OR (firstName = ? AND lastName = ?))'
    ).get(ctx.workspaceId, companyId, linkedinUrl, prof.firstName, prof.lastName);

    if (existing) {
      ctx.emitLog(`Skipped duplicate executive contact: ${prof.firstName} ${prof.lastName}`, 'info');
      continue;
    }

    const contactId = randomUUID();

    db.transaction(() => {
      db.prepare(`
        INSERT INTO contacts (id, workspaceId, companyId, firstName, lastName, title, headline, linkedinUrl, status, type, sourcePlatform, syncStatus, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'NEW', 'executive', 'linkedin', 'pending', datetime('now'), datetime('now'))
      `).run(contactId, ctx.workspaceId, companyId, prof.firstName, prof.lastName, prof.headline, prof.headline, linkedinUrl);

      db.prepare(`
        INSERT INTO sync_queue (id, workspaceId, entityType, entityId, operation, payload, version, retryCount, lastError, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, 'CREATE', ?, 1, 0, NULL, datetime('now'), datetime('now'))
      `).run(
        randomUUID(),
        ctx.workspaceId,
        'contacts',
        contactId,
        JSON.stringify({
          id: contactId,
          workspaceId: ctx.workspaceId,
          firstName: prof.firstName || '',
          lastName: prof.lastName || undefined,
          status: 'NEW',
        })
      );
    })();

    storedCount++;
    ctx.emitLog(`Saved executive contact: ${prof.firstName} ${prof.lastName} (${prof.headline || 'Decision Maker'})`, 'info');
  }

  db.close();

  ctx.updateProgress(100, { step: 3, current: 3, total: 3, description: `Enriched ${storedCount} executive contacts` });
  ctx.emitLog(`LinkedIn Executive Enrichment completed for "${companyName}". Found and saved: ${storedCount} decision makers.`, 'info');

  return { status: 'success', companyId, companyName, enrichedCount: storedCount };
}
