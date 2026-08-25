import Database from 'better-sqlite3';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { JobContext } from '../../../shared/types/job';

interface ContactRecord {
  id: string;
  companyId: string;
  email: string;
  sourceUrl?: string | null;
  phone?: string | null;
  type?: string | null;
  confidence?: string | null;
  verificationStatus?: string | null;
}

interface CompanyRecord {
  id: string;
  website?: string | null;
  location?: string | null;
}

/**
 * Validates email structure and rejects obvious test/garbage patterns.
 */
function isValidEmail(email: string): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  const formatOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower);
  if (!formatOk) return false;

  const prefix = lower.split('@')[0] || '';
  const garbagePrefixes = ['test', 'example', 'abc', 'foo', 'bar', 'admin123', 'a.b.c'];
  if (garbagePrefixes.includes(prefix)) return false;

  const domain = lower.split('@')[1] || '';
  const garbageDomains = ['example.com', 'test.com', 'domain.com', 'email.com'];
  if (garbageDomains.includes(domain)) return false;

  return true;
}

/**
 * Normalizes email address.
 */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Extracts base domain from URL (e.g. "https://www.example.com/contact" -> "example.com").
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
 * Deterministically classifies email type.
 */
function classifyEmail(email: string): 'human' | 'department' | 'unknown' {
  const prefix = (email.split('@')[0] || '').toLowerCase();
  const departmentPrefixes = [
    'info',
    'hello',
    'contact',
    'support',
    'sales',
    'careers',
    'jobs',
    'billing',
    'admin',
    'office',
    'team',
    'general',
    'marketing',
    'press',
    'media',
    'help',
    'service'
  ];
  if (departmentPrefixes.includes(prefix)) {
    return 'department';
  }
  if (prefix.includes('.') || prefix.includes('_') || (prefix.length > 3 && prefix.length < 15)) {
    return 'human';
  }
  return 'unknown';
}

/**
 * Determines confidence level of contact.
 */
function calculateConfidence(
  email: string,
  sourceUrl: string | null,
  companyWebsite: string | null
): 'high' | 'medium' | 'low' {
  const emailDomain = email.split('@')[1]?.toLowerCase() || '';
  const companyDomain = companyWebsite ? extractDomain(companyWebsite) : null;
  const isDomainMatch = companyDomain && emailDomain === companyDomain;

  const type = classifyEmail(email);

  if (isDomainMatch) {
    if (type === 'human') {
      const path = sourceUrl ? new URL(sourceUrl).pathname.toLowerCase() : '';
      const isContactPage = path.match(
        /\/(contact|about|team|staff|people|meet-the-team|leadership)/i
      );
      if (isContactPage) {
        return 'high';
      }
    }
    if (type === 'department') {
      return 'medium';
    }
  }

  return 'low';
}

/**
 * Calculates lead score for a company based on real database contact records.
 */
function calculateCompanyScore(
  contacts: { confidence: string | null }[],
  website: string | null,
  phone: string | null,
  location: string | null
): number {
  let score = 0;

  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  for (const c of contacts) {
    if (c.confidence === 'high') highCount++;
    else if (c.confidence === 'medium') mediumCount++;
    else if (c.confidence === 'low') lowCount++;
  }

  // Scoring weights:
  // High confidence contact: 30 pts (max 90)
  score += Math.min(highCount * 30, 90);

  // Medium confidence contact: 15 pts (max 45)
  score += Math.min(mediumCount * 15, 45);

  // Low confidence contact: 5 pts (max 15)
  score += Math.min(lowCount * 5, 15);

  // Profile data completion:
  if (website) score += 10;
  if (phone) score += 10;
  if (location) score += 5;

  return Math.min(score, 100);
}

/**
 * Website Enrichment Worker Plugin.
 * Rewrites the mock/simulation enricher to validate and score real crawled contact details.
 */
export async function enrichWebsite(ctx: JobContext): Promise<any> {
  const companyId = ctx.payload.companyId as string | undefined;

  ctx.emitLog(
    `Initializing Website Contact Enricher plugin. Workspace: ${ctx.workspaceId} | Target Company: ${companyId || 'ALL'}`,
    'info'
  );

  const dbPath = ctx.dbPath || (process.env.WORKSPACES_DB_DIR ? join(process.env.WORKSPACES_DB_DIR, `leadforge_${ctx.workspaceId}.db`) : '');
  if (!dbPath) {
    throw new Error('Database path could not be resolved for background worker.');
  }

  ctx.emitLog(`Opening database connection at: ${dbPath}`, 'info');
  const db = new Database(dbPath);

  // Restore state from checkpoint if resuming
  const checkpoint = ctx.getCheckpoint();
  const processedContacts = new Set<string>();
  let currentIndex = 0;
  if (checkpoint) {
    checkpoint.processedContacts?.forEach((id: string) => processedContacts.add(id));
    currentIndex = checkpoint.currentIndex || 0;
    ctx.emitLog(
      `Resuming enrichment from checkpoint. Processed: ${processedContacts.size} contacts.`,
      'info'
    );
  }

  try {
    // 1. Fetch contacts requiring enrichment
    let contacts: ContactRecord[] = [];
    if (companyId) {
      contacts = db
        .prepare(
          `
        SELECT id, companyId, email, sourceUrl, phone
        FROM contacts
        WHERE workspaceId = ? AND companyId = ?
      `
        )
        .all(ctx.workspaceId, companyId) as ContactRecord[];
    } else {
      contacts = db
        .prepare(
          `
        SELECT id, companyId, email, sourceUrl, phone
        FROM contacts
        WHERE workspaceId = ?
      `
        )
        .all(ctx.workspaceId) as ContactRecord[];
    }

    if (contacts.length === 0) {
      ctx.emitLog('No contacts found requiring enrichment.', 'info');
      return { enrichedCount: 0 };
    }

    ctx.emitLog(
      `Retrieved ${contacts.length} candidate contacts for enrichment. Checking duplicates...`,
      'info'
    );

    // 2. Local duplicate detection & clean up in SQLite
    const seenEmails = new Map<string, string>(); // email -> contactId
    const duplicatesToDelete: string[] = [];

    for (const c of contacts) {
      const norm = normalizeEmail(c.email);
      if (seenEmails.has(norm)) {
        duplicatesToDelete.push(c.id);
      } else {
        seenEmails.set(norm, c.id);
      }
    }

    if (duplicatesToDelete.length > 0) {
      ctx.emitLog(
        `Deduplicating workspace contacts: removing ${duplicatesToDelete.length} redundant rows.`,
        'info'
      );
      db.transaction(() => {
        const delStmt = db.prepare('DELETE FROM contacts WHERE id = ?');
        const delSync = db.prepare(
          "DELETE FROM sync_queue WHERE entityType = 'contacts' AND entityId = ?"
        );
        for (const id of duplicatesToDelete) {
          delStmt.run(id);
          delSync.run(id);
        }
      })();
      // Re-fetch contacts list after deletion
      contacts = contacts.filter((c) => !duplicatesToDelete.includes(c.id));
    }

    // 3. Process and enrich contacts
    let enrichedCount = 0;
    const companyCache = new Map<string, CompanyRecord>();

    for (let i = currentIndex; i < contacts.length; i++) {
      if (ctx.isCancelled()) {
        ctx.emitLog('Enricher execution cancelled by scheduler.', 'warn');
        throw new Error('Job cancelled.');
      }
      if (ctx.isPaused()) {
        ctx.emitLog('Enricher execution paused. Saving checkpoint.', 'warn');
        ctx.saveCheckpoint({ processedContacts: Array.from(processedContacts), currentIndex: i });
        throw new Error('Job paused.');
      }

      const contact = contacts[i];
      if (!contact) continue;

      try {
        const normEmail = normalizeEmail(contact.email);

        // Fetch company profile for domain matching
        if (!companyCache.has(contact.companyId)) {
          const comp = db
            .prepare('SELECT id, website, location FROM companies WHERE id = ?')
            .get(contact.companyId) as CompanyRecord | undefined;
          if (comp) {
            companyCache.set(contact.companyId, comp);
          }
        }
        const company = companyCache.get(contact.companyId);

        let type: 'human' | 'department' | 'unknown' = 'unknown';
        let confidence: 'high' | 'medium' | 'low' = 'low';
        let verificationStatus = 'unverified';

        if (!isValidEmail(normEmail)) {
          ctx.emitLog(`Rejected invalid or test email address: "${contact.email}"`, 'warn');
          verificationStatus = 'invalid';
          confidence = 'low';
        } else {
          type = classifyEmail(normEmail);
          confidence = calculateConfidence(
            normEmail,
            contact.sourceUrl || null,
            company?.website || null
          );
          enrichedCount++;
        }

        // Persist enriched details to contacts and stage sync task
        db.transaction(() => {
          db.prepare(
            `
            UPDATE contacts
            SET email = ?,
                type = ?,
                confidence = ?,
                verificationStatus = ?,
                updatedAt = CURRENT_TIMESTAMP
            WHERE id = ?
          `
          ).run(normEmail, type, confidence, verificationStatus, contact.id);

          db.prepare(
            `
            INSERT INTO sync_queue (id, workspaceId, entityType, entityId, operation, payload, version, retryCount, lastError, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, 'UPDATE', ?, 1, 0, NULL, datetime('now'), datetime('now'))
          `
          ).run(
            randomUUID(),
            ctx.workspaceId,
            'contacts',
            contact.id,
            JSON.stringify({
              id: contact.id,
              workspaceId: ctx.workspaceId,
              email: normEmail,
              type,
              confidence,
              verificationStatus
            })
          );
        })();

        processedContacts.add(contact.id);

        // Update progress
        const progress = Math.round(((i + 1) / contacts.length) * 100);
        ctx.updateProgress(progress, {
          current: i + 1,
          total: contacts.length,
          entity: contact.email,
          description: `Enriched ${i + 1} of ${contacts.length} contacts`
        });

        // Autosave checkpoint every 10 contacts
        if (processedContacts.size % 10 === 0) {
          ctx.saveCheckpoint({
            processedContacts: Array.from(processedContacts),
            currentIndex: i + 1
          });
          ctx.emitLog(`Autosaved enrichment checkpoint at index ${i + 1}.`, 'info');
        }
      } catch (err: any) {
        ctx.emitLog(`Failed to enrich contact ${contact.id}: ${err.message || err}`, 'error');
      }
    }

    // 4. Update Lead Scores for companies processed
    const companiesToUpdate = companyId ? [companyId] : Array.from(companyCache.keys());
    ctx.emitLog(
      `Computing profiles lead scores for ${companiesToUpdate.length} companies...`,
      'info'
    );

    for (const compId of companiesToUpdate) {
      try {
        const comp = db
          .prepare('SELECT id, website, location FROM companies WHERE id = ?')
          .get(compId) as CompanyRecord | undefined;
        if (!comp) continue;

        const compContacts = db
          .prepare('SELECT confidence FROM contacts WHERE companyId = ?')
          .all(compId) as { confidence: string | null }[];
        const phoneRow = db
          .prepare('SELECT phone FROM contacts WHERE companyId = ? AND phone IS NOT NULL LIMIT 1')
          .get(compId) as { phone: string } | undefined;

        const score = calculateCompanyScore(
          compContacts,
          comp.website || null,
          phoneRow?.phone || null,
          comp.location || null
        );

        db.transaction(() => {
          db.prepare(
            `
            UPDATE companies
            SET contactCount = ?,
                score = ?,
                scoreUpdatedAt = datetime('now'),
                updatedAt = CURRENT_TIMESTAMP
            WHERE id = ?
          `
          ).run(compContacts.length, score, compId);

          db.prepare(
            `
            INSERT INTO sync_queue (id, workspaceId, entityType, entityId, operation, payload, version, retryCount, lastError, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, 'UPDATE', ?, 1, 0, NULL, datetime('now'), datetime('now'))
          `
          ).run(
            randomUUID(),
            ctx.workspaceId,
            'companies',
            compId,
            JSON.stringify({
              id: compId,
              workspaceId: ctx.workspaceId,
              contactCount: compContacts.length,
              score
            })
          );
        })();

        ctx.emitLog(
          `Updated Lead Score for company ${compId}: ${score} (Contacts: ${compContacts.length})`,
          'info'
        );
      } catch (scoreErr: any) {
        ctx.emitLog(
          `Failed to calculate score for company ${compId}: ${scoreErr.message || scoreErr}`,
          'error'
        );
      }
    }

    ctx.emitLog(
      `Enrichment complete. Total contacts successfully enriched: ${enrichedCount}`,
      'info'
    );
    return { enrichedCount };
  } finally {
    db.close();
  }
}
