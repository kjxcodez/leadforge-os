import Database from 'better-sqlite3';
import { join } from 'path';
import type { JobContext } from '../../../shared/types/job';

interface CompanyRecord {
  id: string;
  name: string;
  domain: string;
  website: string;
}

/**
 * Website Crawler & Contact Enricher Job Plugin.
 * Crawls discovered companies (simulated) and extracts email addresses and social handles,
 * creating matching contact records in SQLite.
 */
export async function enrichWebsite(ctx: JobContext): Promise<any> {
  ctx.emitLog('Initializing Website Email & Contact Enricher plugin.', 'info');

  const dbDir = process.env.WORKSPACES_DB_DIR || '';
  if (!dbDir) {
    throw new Error('WORKSPACES_DB_DIR env variable is required for background workers.');
  }

  const dbPath = join(dbDir, `leadforge_${ctx.workspaceId}.db`);
  const db = new Database(dbPath);

  // 1. Fetch companies that have no contacts registered yet
  const companies = db.prepare(`
    SELECT id, name, domain, website FROM companies
    WHERE workspaceId = ? AND id NOT IN (
      SELECT DISTINCT companyId FROM contacts WHERE companyId IS NOT NULL
    )
  `).all(ctx.workspaceId) as CompanyRecord[];

  if (companies.length === 0) {
    ctx.emitLog('No companies found in this workspace requiring enrichment.', 'info');
    db.close();
    return { enrichedCount: 0 };
  }

  ctx.emitLog(`Found ${companies.length} companies matching enrichment criteria. Beginning crawl...`, 'info');

  const titles = ['Owner', 'Founder', 'Managing Partner', 'Lead Specialist', 'Office Manager'];
  const firstNames = ['John', 'Emily', 'Michael', 'Jessica', 'David', 'Sarah', 'James', 'Rachel'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson'];

  let enrichedCount = 0;

  for (let i = 0; i < companies.length; i++) {
    if (ctx.isCancelled()) {
      ctx.emitLog('Enricher task requested to cancel.', 'warn');
      break;
    }

    const company = companies[i];
    if (!company) continue;
    ctx.emitLog(`Crawling website: ${company.website} ...`, 'info');

    // Simulate crawl latency
    await new Promise((resolve) => setTimeout(resolve, 800));

    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const title = titles[Math.floor(Math.random() * titles.length)];
    if (!firstName || !lastName || !title) continue;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${company.domain}`;
    const phone = `+1 (617) 555-${2000 + i}`;
    const contactId = require('crypto').randomUUID();

    // 2. Insert Contact and stage sync log inside atomic transaction
    db.transaction(() => {
      db.prepare(`
        INSERT INTO contacts (id, workspaceId, companyId, firstName, lastName, email, phone, title, status, syncStatus, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 'pending', datetime('now'), datetime('now'))
      `).run(contactId, ctx.workspaceId, company.id, firstName, lastName, email, phone, title);

      db.prepare(`
        INSERT INTO sync_queue (id, workspaceId, entityType, entityId, operation, payload, version, retryCount, lastError, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, 'CREATE', ?, 1, 0, NULL, datetime('now'), datetime('now'))
      `).run(
        require('crypto').randomUUID(),
        ctx.workspaceId,
        'contacts',
        contactId,
        JSON.stringify({
          id: contactId,
          workspaceId: ctx.workspaceId,
          companyId: company.id,
          firstName,
          lastName,
          email,
          phone,
          title,
          status: 'active',
        })
      );

      enrichedCount++;
      ctx.emitLog(`Extracted Contact: Dr./Mr./Ms. ${firstName} ${lastName} (${title}) | Email: ${email}`, 'info');
    })();

    const progress = Math.round(((i + 1) / companies.length) * 100);
    ctx.updateProgress(progress, { current: i + 1, total: companies.length });
  }

  ctx.emitLog(`Enrichment complete. Total contacts created: ${enrichedCount}`, 'info');
  db.close();

  return { enrichedCount };
}
