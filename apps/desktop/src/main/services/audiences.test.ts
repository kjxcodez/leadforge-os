import Database from 'better-sqlite3';
import { runMigrations } from '../database/runner';
import { randomUUID } from 'crypto';
import assert from 'assert';

export async function runAudiencesTests() {
  console.log('--- STARTING AUDIENCES & CRM FOUNDATION INTEGRATION TESTS ---');

  // 1. Initialize clean in-memory database
  const db = new Database(':memory:');
  console.log('[Test] Created in-memory SQLite database.');

  // 2. Run migrations
  runMigrations(db);
  console.log('[Test] Applied schema migrations successfully.');

  const wsA = randomUUID();
  const wsB = randomUUID();

  // 3. Populate test CRM contacts and companies for Workspace A and Workspace B
  const companyA1 = randomUUID();
  const companyA2 = randomUUID();
  const contactA1 = randomUUID();
  const contactA2 = randomUUID();
  const contactA3 = randomUUID();
  const contactB1 = randomUUID();

  db.prepare(`
    INSERT INTO companies (id, workspaceId, name, domain, industry, location, status, createdAt, updatedAt)
    VALUES (?, ?, 'Acme Corp', 'acme.com', 'HVAC', 'Miami, FL', 'QUALIFIED', datetime('now'), datetime('now'))
  `).run(companyA1, wsA);

  db.prepare(`
    INSERT INTO companies (id, workspaceId, name, domain, industry, location, status, createdAt, updatedAt)
    VALUES (?, ?, 'Apex Logistics', 'apex.com', 'Logistics', 'Dallas, TX', 'PROSPECT', datetime('now'), datetime('now'))
  `).run(companyA2, wsA);

  db.prepare(`
    INSERT INTO contacts (id, workspaceId, companyId, firstName, lastName, email, title, source, status, createdAt, updatedAt)
    VALUES (?, ?, ?, 'Alice', 'Smith', 'alice@acme.com', 'CEO', 'manual', 'QUALIFIED', datetime('now'), datetime('now'))
  `).run(contactA1, wsA, companyA1);

  db.prepare(`
    INSERT INTO contacts (id, workspaceId, companyId, firstName, lastName, email, title, source, status, createdAt, updatedAt)
    VALUES (?, ?, ?, 'Bob', 'Jones', 'bob@acme.com', 'CTO', 'discovery', 'QUALIFIED', datetime('now'), datetime('now'))
  `).run(contactA2, wsA, companyA1);

  db.prepare(`
    INSERT INTO contacts (id, workspaceId, companyId, firstName, lastName, email, title, source, status, createdAt, updatedAt)
    VALUES (?, ?, ?, 'Charlie', 'Brown', 'charlie@apex.com', 'Director', 'manual', 'PROSPECT', datetime('now'), datetime('now'))
  `).run(contactA3, wsA, companyA2);

  // Workspace B contact (to test isolation)
  db.prepare(`
    INSERT INTO contacts (id, workspaceId, companyId, firstName, lastName, email, title, source, status, createdAt, updatedAt)
    VALUES (?, ?, NULL, 'Foreign', 'User', 'foreign@wsb.com', 'Manager', 'manual', 'QUALIFIED', datetime('now'), datetime('now'))
  `).run(contactB1, wsB);

  console.log('✅ Mock CRM data seeded across workspaces.');

  // 4. Test Static Audience Resolution & Workspace Isolation
  const staticAudienceId = randomUUID();
  // Store selected IDs including contactA1, contactA2, and contactB1 (wsB foreign contact)
  db.prepare(`
    INSERT INTO audiences (id, workspaceId, name, mode, staticMemberIds, filterDefinition, createdAt, updatedAt)
    VALUES (?, ?, 'Test Static Segment', 'static', ?, '{}', datetime('now'), datetime('now'))
  `).run(staticAudienceId, wsA, JSON.stringify([contactA1, contactA2, contactB1]));

  // Resolution helper for static mode
  const resolveStatic = (audId: string, wsId: string) => {
    const aud = db.prepare('SELECT * FROM audiences WHERE id = ?').get(audId) as any;
    let memberIds: string[] = [];
    try { memberIds = JSON.parse(aud.staticMemberIds); } catch {}

    const placeholders = memberIds.map(() => '?').join(', ');
    const rows = db.prepare(
      `SELECT id FROM contacts WHERE id IN (${placeholders}) AND workspaceId = ? AND deletedAt IS NULL`
    ).all(...memberIds, wsId) as Array<{ id: string }>;

    return rows.map((r) => r.id);
  };

  const resolvedStaticA = resolveStatic(staticAudienceId, wsA);
  assert.strictEqual(resolvedStaticA.length, 2);
  assert.ok(resolvedStaticA.includes(contactA1));
  assert.ok(resolvedStaticA.includes(contactA2));
  assert.ok(!resolvedStaticA.includes(contactB1)); // Workspace B contact excluded!
  console.log('✅ Static Audience resolution and workspace isolation verified.');

  // 5. Test Missing / Deleted Contact Handling in Static Audience
  // Soft-delete contactA2
  db.prepare("UPDATE contacts SET deletedAt = datetime('now') WHERE id = ?").run(contactA2);

  const resolvedStaticAfterDelete = resolveStatic(staticAudienceId, wsA);
  assert.strictEqual(resolvedStaticAfterDelete.length, 1);
  assert.strictEqual(resolvedStaticAfterDelete[0], contactA1);
  console.log('✅ Static Audience graceful handling of deleted contacts verified.');

  // Restore contactA2 for remaining tests
  db.prepare("UPDATE contacts SET deletedAt = NULL WHERE id = ?").run(contactA2);

  // 6. Test Dynamic Audience Resolution & Auto-Qualification
  const dynamicAudienceId = randomUUID();
  db.prepare(`
    INSERT INTO audiences (id, workspaceId, name, mode, filterDefinition, createdAt, updatedAt)
    VALUES (?, ?, 'Miami HVAC Dynamic Segment', 'dynamic', ?, datetime('now'), datetime('now'))
  `).run(dynamicAudienceId, wsA, JSON.stringify({ industry: 'HVAC' }));

  const resolveDynamic = (filter: any, wsId: string) => {
    let companyQuery = 'SELECT id FROM companies WHERE workspaceId = ? AND deletedAt IS NULL';
    const companyParams: any[] = [wsId];

    if (filter.industry) {
      companyQuery += ' AND industry LIKE ?';
      companyParams.push(`%${filter.industry}%`);
    }

    const companyRows = db.prepare(companyQuery).all(...companyParams) as Array<{ id: string }>;
    const companyIds = companyRows.map((r) => r.id);

    let contactQuery = 'SELECT id FROM contacts WHERE workspaceId = ? AND deletedAt IS NULL';
    const contactParams: any[] = [wsId];

    if (companyIds.length > 0) {
      contactQuery += ` AND companyId IN (${companyIds.map(() => '?').join(', ')})`;
      contactParams.push(...companyIds);
    }

    const contactRows = db.prepare(contactQuery).all(...contactParams) as Array<{ id: string }>;
    return contactRows.map((r) => r.id);
  };

  const resolvedDynamicInitial = resolveDynamic({ industry: 'HVAC' }, wsA);
  assert.strictEqual(resolvedDynamicInitial.length, 2);
  assert.ok(resolvedDynamicInitial.includes(contactA1));
  assert.ok(resolvedDynamicInitial.includes(contactA2));

  // Add a new HVAC contact -> verify auto-qualification
  const contactA4 = randomUUID();
  db.prepare(`
    INSERT INTO contacts (id, workspaceId, companyId, firstName, lastName, email, title, source, status, createdAt, updatedAt)
    VALUES (?, ?, ?, 'David', 'Miller', 'david@acme.com', 'VP Sales', 'manual', 'QUALIFIED', datetime('now'), datetime('now'))
  `).run(contactA4, wsA, companyA1);

  const resolvedDynamicUpdated = resolveDynamic({ industry: 'HVAC' }, wsA);
  assert.strictEqual(resolvedDynamicUpdated.length, 3);
  assert.ok(resolvedDynamicUpdated.includes(contactA4));
  console.log('✅ Dynamic Audience resolution & auto-qualification of new matching contact verified.');

  // 7. Test Structured CRM Queries
  const queryCompanies = (wsId: string, search?: string, industry?: string, location?: string) => {
    let q = 'SELECT * FROM companies WHERE workspaceId = ? AND deletedAt IS NULL';
    const params: any[] = [wsId];
    if (search) {
      q += ' AND (name LIKE ? OR domain LIKE ? OR industry LIKE ?)';
      const t = `%${search}%`;
      params.push(t, t, t);
    }
    if (industry) {
      q += ' AND industry LIKE ?';
      params.push(`%${industry}%`);
    }
    if (location) {
      q += ' AND location LIKE ?';
      params.push(`%${location}%`);
    }
    return db.prepare(q).all(...params) as any[];
  };

  const saasResults = queryCompanies(wsA, undefined, 'HVAC');
  assert.strictEqual(saasResults.length, 1);
  assert.strictEqual(saasResults[0].name, 'Acme Corp');

  const miamiResults = queryCompanies(wsA, undefined, undefined, 'Miami');
  assert.strictEqual(miamiResults.length, 1);
  assert.strictEqual(miamiResults[0].name, 'Acme Corp');

  console.log('✅ Structured CRM company queries verified.');

  console.log('--- ALL AUDIENCES & CRM FOUNDATION TESTS PASSED ---');
}

if (require.main === module) {
  runAudiencesTests().catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
}
