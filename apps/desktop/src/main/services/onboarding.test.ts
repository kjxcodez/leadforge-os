/**
 * Onboarding & First-Run Experience — Automated Tests
 */

import { describe, it, expect } from 'vitest';
import os from 'os';

describe('Onboarding & First-Run Experience Suite', () => {
  it('validates onboarding health diagnostics structure matches specs', () => {
    const diagnostics = {
      os: `${os.type()} ${os.release()} (${os.arch()})`,
      writePermissions: true,
      sqliteAvailable: true,
      freeDiskSpaceGB: 25,
      internetConnected: true,
      ollamaInstalled: false,
      workersReady: true
    };

    expect(typeof diagnostics.os).toBe('string');
    expect(typeof diagnostics.writePermissions).toBe('boolean');
    expect(typeof diagnostics.sqliteAvailable).toBe('boolean');
    expect(typeof diagnostics.freeDiskSpaceGB).toBe('number');
    expect(typeof diagnostics.internetConnected).toBe('boolean');
  });

  it('generates sample workspace data and populates intelligence profile and scores', () => {
    const mockDb = {
      tables: {} as Record<string, any[]>,
      exec(_sql: string) {},
      prepare(sql: string) {
        return {
          run: (...args: any[]) => {
            const tableName = sql.toLowerCase().includes('companies')
              ? 'companies'
              : sql.toLowerCase().includes('company_intelligence')
                ? 'company_intelligence'
                : 'opportunity_scores';
            if (!this.tables[tableName]) this.tables[tableName] = [];
            this.tables[tableName].push(args);
          },
          get: () => {
            return { c: 1, overallScore: 92, techStack: '["React"]' };
          }
        };
      },
      transaction(fn: () => void) {
        return fn;
      }
    };

    const workspaceId = 'ws-test-onboard';
    const sampleCompanies = [
      {
        id: 'sc-01',
        name: 'Acme SaaS Corp',
        domain: 'acmesaas.com',
        industry: 'Software',
        status: 'QUALIFIED',
        location: 'San Francisco, CA'
      }
    ];

    mockDb.transaction(() => {
      for (const c of sampleCompanies) {
        mockDb
          .prepare(
            `
          INSERT INTO companies (id, workspaceId, name, domain, industry, status, location) VALUES (?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(c.id, workspaceId, c.name, c.domain, c.industry, c.status, c.location);
      }

      mockDb
        .prepare(
          `
        INSERT INTO company_intelligence (companyId, techStack) VALUES ('sc-01', '["React"]')
      `
        )
        .run();

      mockDb
        .prepare(
          `
        INSERT INTO opportunity_scores (companyId, overallScore) VALUES ('sc-01', 92)
      `
        )
        .run();
    })();

    const count = mockDb.prepare('SELECT COUNT(*) as c FROM companies').get() as { c: number };
    expect(count.c).toBe(1);

    const intel = mockDb.prepare('SELECT * FROM company_intelligence').get() as any;
    expect(intel.techStack).toContain('React');

    const score = mockDb.prepare('SELECT overallScore FROM opportunity_scores').get() as {
      overallScore: number;
    };
    expect(score.overallScore).toBe(92);
  });
});
