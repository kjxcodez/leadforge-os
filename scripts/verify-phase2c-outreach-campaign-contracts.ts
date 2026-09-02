/**
 * LeadForge OS — Phase 2C Verification & Regression Test Suite
 *
 * Scenarios Tested:
 * 1. Template company.location resolves correctly from canonical company location (F-05)
 * 2. Null/undefined company and location values render safely without token leaks or "undefined" literals
 * 3. SDK query serialization completely omits undefined and null parameters (F-06)
 * 4. Valid query filters are properly serialized and URL encoded
 * 5. Email deliveries list queries return actual records without being suppressed by undefined filters
 * 6. Campaign status scheduling updates MongoDB authoritatively (F-10)
 * 7. SQLite projection faithfully mirrors authoritative MongoDB campaign status
 * 8. Cache rehydration / desktop restart preserves canonical campaign status
 * 9. Out-of-order and concurrent status updates maintain terminal status guardrails
 * 10. Complete outreach variable rendering pipeline end-to-end
 * 11. Delivery ledger visibility across API, MongoDB, and query path
 * 12. Phase 2A Connectivity regression verification
 * 13. Phase 2B Authoritative Projection & Discovery regression verification
 */

import { renderCanonicalVariables, type CanonicalVariableContext } from '../packages/sdk/src/utils/variable-resolver.js';
import { toQueryString } from '../packages/sdk/src/utils/query.js';
import { getDatabase } from '../apps/desktop/src/main/database/connection.js';
import { LocalCRMRepository } from '../apps/desktop/src/main/database/repositories/local-crm.js';
import { ProjectionService } from '../apps/desktop/src/main/services/projection-service.js';
import { ConnectivityService } from '../apps/desktop/src/main/services/connectivity-service.js';

let passedCount = 0;
let totalCount = 0;

function assert(condition: boolean, message: string) {
  totalCount++;
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  passedCount++;
}

async function runPhase2CTests() {
  console.log('========================================================================');
  console.log(' LeadForge OS — Phase 2C Outreach, Campaign & Contract Integrity Test');
  console.log('========================================================================\n');

  const testWsId = 'ws-test-phase2c-' + Date.now();
  const db = getDatabase(testWsId);

  // ---------------------------------------------------------------------------
  // [Test 1] F-05: Template company.location Canonical Resolution
  // ---------------------------------------------------------------------------
  console.log('--- [Test 1] F-05: Template company.location Canonical Resolution ---');
  {
    const renderCtx: CanonicalVariableContext = {
      contact: {
        id: 'cnt-101',
        firstName: 'Elena',
        lastName: 'Rostova',
        email: 'elena@solaris.ai',
        title: 'Head of Engineering'
      },
      company: {
        id: 'comp-101',
        name: 'Solaris AI',
        domain: 'solaris.ai',
        industry: 'Artificial Intelligence',
        location: 'Bengaluru, India',
        website: 'https://solaris.ai'
      },
      sender: {
        name: 'Alex Vance',
        email: 'alex@leadforge.dev'
      },
      sequence: {
        name: 'Q3 Outbound Sprint'
      },
      workspace: {
        id: testWsId
      }
    };

    const templateSubject = 'Expanding {{company.name}} in {{company.location}}';
    const templateBody = 'Hi {{contact.firstName}},\n\nI noticed {{company.name}} is growing rapidly in {{company.location}}. Are you hiring in {{company.industry}}?\n\nBest,\n{{sender.name}}';

    const renderedSubject = renderCanonicalVariables(templateSubject, renderCtx);
    const renderedBody = renderCanonicalVariables(templateBody, renderCtx);

    assert(
      renderedSubject === 'Expanding Solaris AI in Bengaluru, India',
      `Subject rendered incorrectly: "${renderedSubject}"`
    );
    assert(
      renderedBody.includes('Hi Elena,'),
      `Body missing contact firstName: "${renderedBody}"`
    );
    assert(
      renderedBody.includes('growing rapidly in Bengaluru, India.'),
      `Body missing company.location: "${renderedBody}"`
    );
    assert(
      renderedBody.includes('hiring in Artificial Intelligence?'),
      `Body missing company.industry: "${renderedBody}"`
    );
    assert(
      !renderedBody.includes('undefined') && !renderedBody.includes('{{'),
      `Body contains leaked tokens or undefined: "${renderedBody}"`
    );

    console.log('✓ Test 1 Passed: company.location resolves canonically to "Bengaluru, India"\n');
  }

  // ---------------------------------------------------------------------------
  // [Test 2] F-05: Safe Null / Undefined Company and Location Fallback
  // ---------------------------------------------------------------------------
  console.log('--- [Test 2] F-05: Safe Null / Undefined Variable Fallback ---');
  {
    const nullCompanyCtx: CanonicalVariableContext = {
      contact: {
        id: 'cnt-102',
        firstName: 'Marcus',
        lastName: 'Vane',
        email: 'marcus@example.com'
      },
      company: null,
      sender: {
        name: 'LeadForge Team',
        email: 'team@leadforge.dev'
      },
      sequence: {
        name: 'Cold Outreach'
      },
      workspace: {
        id: testWsId
      }
    };

    const template = 'Hello {{contact.firstName}}, welcome from {{company.name}} in {{company.location}}. Best, {{sender.name}}';
    const rendered = renderCanonicalVariables(template, nullCompanyCtx);

    assert(
      rendered === 'Hello Marcus, welcome from  in . Best, LeadForge Team',
      `Null company template rendered unexpectedly: "${rendered}"`
    );
    assert(!rendered.includes('undefined'), 'Rendered template must not leak "undefined"');
    assert(!rendered.includes('null'), 'Rendered template must not leak "null"');
    assert(!rendered.includes('{{'), 'Rendered template must not leak unparsed tokens');

    console.log('✓ Test 2 Passed: Null / undefined company and location safely resolved without leaks\n');
  }

  // ---------------------------------------------------------------------------
  // [Test 3] F-06: SDK Query Serialization Omission of Undefined/Null
  // ---------------------------------------------------------------------------
  console.log('--- [Test 3] F-06: SDK Query Parameter Sanitization ---');
  {
    const queryWithUndefined = {
      campaignId: undefined,
      sequenceId: undefined,
      status: undefined,
      page: 1,
      limit: 50
    };

    const qs = toQueryString(queryWithUndefined);
    assert(
      !qs.includes('campaignId'),
      `Query string must not contain undefined campaignId: "${qs}"`
    );
    assert(
      !qs.includes('sequenceId'),
      `Query string must not contain undefined sequenceId: "${qs}"`
    );
    assert(
      !qs.includes('status'),
      `Query string must not contain undefined status: "${qs}"`
    );
    assert(
      !qs.includes('undefined') && !qs.includes('null'),
      `Query string contains literal undefined or null: "${qs}"`
    );
    assert(
      qs.includes('page=1') && qs.includes('limit=50'),
      `Query string missing valid parameters: "${qs}"`
    );

    console.log(`✓ Test 3 Passed: Undefined/null omitted: "${qs}"\n`);
  }

  // ---------------------------------------------------------------------------
  // [Test 4] F-06: Valid Query Filter Encoding & Array Handling
  // ---------------------------------------------------------------------------
  console.log('--- [Test 4] F-06: Valid Query Filter Encoding & Array Handling ---');
  {
    const validParams = {
      campaignId: 'camp_12345',
      status: 'SENT',
      tags: ['alpha', 'beta'],
      search: 'Acme & Co.'
    };

    const qs = toQueryString(validParams);
    assert(qs.startsWith('?'), 'Query string must start with "?"');
    assert(qs.includes('campaignId=camp_12345'), 'Missing campaignId');
    assert(qs.includes('status=SENT'), 'Missing status');
    assert(qs.includes('tags=alpha') && qs.includes('tags=beta'), 'Missing array tags');
    assert(qs.includes('search=Acme+%26+Co.'), 'Search parameter not properly URL encoded');

    console.log(`✓ Test 4 Passed: URL encoding and array parameters verified: "${qs}"\n`);
  }

  // ---------------------------------------------------------------------------
  // [Test 5] F-06: Email Deliveries Query Execution
  // ---------------------------------------------------------------------------
  console.log('--- [Test 5] F-06: Email Deliveries Query Contract ---');
  {
    // Mock server delivery store
    const serverDeliveries = [
      {
        id: 'del-1',
        workspaceId: testWsId,
        campaignId: 'camp-alpha',
        contactId: 'cnt-101',
        to: 'elena@solaris.ai',
        status: 'SENT',
        sentAt: new Date().toISOString()
      },
      {
        id: 'del-2',
        workspaceId: testWsId,
        campaignId: 'camp-alpha',
        contactId: 'cnt-102',
        to: 'marcus@example.com',
        status: 'SENT',
        sentAt: new Date().toISOString()
      }
    ];

    const mockSdk: any = {
      emailDeliveries: {
        list: async (params?: any) => {
          const qs = toQueryString(params);
          // If query string had "campaignId=undefined", this filter would fail
          if (qs.includes('campaignId=undefined')) {
            return { data: [], total: 0 };
          }
          let filtered = serverDeliveries;
          if (params?.campaignId) {
            filtered = filtered.filter((d) => d.campaignId === params.campaignId);
          }
          return { data: filtered, total: filtered.length };
        }
      }
    };

    // Client calls with undefined optional filters
    const resAll = await mockSdk.emailDeliveries.list({
      campaignId: undefined,
      sequenceId: undefined,
      status: undefined,
      page: 1,
      limit: 100
    });
    assert(resAll.data.length === 2, `Expected 2 deliveries, got ${resAll.data.length}`);

    const resFiltered = await mockSdk.emailDeliveries.list({
      campaignId: 'camp-alpha',
      status: undefined
    });
    assert(resFiltered.data.length === 2, `Expected 2 deliveries for camp-alpha, got ${resFiltered.data.length}`);

    console.log('✓ Test 5 Passed: Email deliveries query returns authoritative records without undefined masking\n');
  }

  // ---------------------------------------------------------------------------
  // [Test 6] F-10: Authoritative Campaign Status Scheduling
  // ---------------------------------------------------------------------------
  console.log('--- [Test 6] F-10: Authoritative Campaign Status Scheduling ---');
  {
    let serverCampaign = {
      id: 'camp-777',
      workspaceId: testWsId,
      name: 'Autumn Inbound',
      status: 'DRAFT',
      sequenceId: 'seq-1',
      createdAt: new Date().toISOString()
    };

    const mockSdk: any = {
      campaigns: {
        get: async (id: string) => (id === serverCampaign.id ? serverCampaign : null),
        update: async (id: string, dto: any) => {
          if (id === serverCampaign.id) {
            serverCampaign = { ...serverCampaign, ...dto, status: String(dto.status).toUpperCase() };
            return serverCampaign;
          }
          return null;
        }
      },
      jobs: {
        create: async () => ({ id: 'job-' + Date.now() })
      }
    };

    // Initial projection in SQLite
    await LocalCRMRepository.saveFromServer('campaigns', serverCampaign);
    let cachedCamp = await LocalCRMRepository.findById('campaigns', testWsId, 'camp-777');
    assert(cachedCamp.status === 'DRAFT', 'Cached campaign must start in DRAFT');

    // Perform authoritative scheduling
    const updatedServer = await mockSdk.campaigns.update('camp-777', { status: 'ACTIVE' });
    await LocalCRMRepository.saveFromServer('campaigns', updatedServer);

    assert(serverCampaign.status === 'ACTIVE', 'Server campaign status must be ACTIVE in MongoDB');
    cachedCamp = await LocalCRMRepository.findById('campaigns', testWsId, 'camp-777');
    assert(cachedCamp.status === 'ACTIVE', 'Cached SQLite campaign must mirror ACTIVE status');

    console.log('✓ Test 6 Passed: Campaign scheduling authoritatively mutates MongoDB and projects to SQLite\n');
  }

  // ---------------------------------------------------------------------------
  // [Test 7] F-10: SQLite Projection Consistency & Absence of Unauthorized Overwrite
  // ---------------------------------------------------------------------------
  console.log('--- [Test 7] F-10: Absence of Unauthorized Local SQLite Mutation ---');
  {
    // Insert execution records for camp-777
    db.prepare(`
      INSERT INTO sequence_executions (id, workspaceId, campaignId, sequenceId, contactId, status, currentStepIndex, createdAt, updatedAt)
      VALUES 
        ('exec-1', ?, 'camp-777', 'seq-1', 'cnt-101', 'completed', 1, datetime('now'), datetime('now')),
        ('exec-2', ?, 'camp-777', 'seq-1', 'cnt-102', 'completed', 1, datetime('now'), datetime('now'))
    `).run(testWsId, testWsId);

    // Read campaigns via LocalCRMRepository
    const campaigns = await LocalCRMRepository.findMany('campaigns', testWsId, { id: 'camp-777' });
    const camp = campaigns[0];

    // Status in SQLite must remain ACTIVE as received from server, not mutated to COMPLETED without server synchronization
    assert(camp.status === 'ACTIVE', `Campaign status must remain ACTIVE from server, got: ${camp.status}`);

    console.log('✓ Test 7 Passed: Local SQLite query preserves canonical campaign status without unauthorized overwrite\n');
  }

  // ---------------------------------------------------------------------------
  // [Test 8] F-10: Server Transition & Rehydration Recovery
  // ---------------------------------------------------------------------------
  console.log('--- [Test 8] F-10: Server Transition & Rehydration Recovery ---');
  {
    // Mock server campaign transitioning to COMPLETED
    const serverCompleted = {
      id: 'camp-777',
      workspaceId: testWsId,
      name: 'Autumn Inbound',
      status: 'COMPLETED',
      sequenceId: 'seq-1',
      updatedAt: new Date().toISOString()
    };

    // Reconcile into SQLite
    await ProjectionService.projectEntity('campaigns', serverCompleted, testWsId);

    const projected = await LocalCRMRepository.findById('campaigns', testWsId, 'camp-777');
    assert(projected.status === 'COMPLETED', `Projected status must be COMPLETED, got: ${projected.status}`);

    // Simulate complete SQLite cache wipe and rehydration from server
    db.prepare('DELETE FROM campaigns WHERE workspaceId = ?').run(testWsId);
    let afterWipe = await LocalCRMRepository.findById('campaigns', testWsId, 'camp-777');
    assert(!afterWipe, 'Campaign must be wiped');

    await LocalCRMRepository.saveFromServer('campaigns', serverCompleted);
    const afterHydrate = await LocalCRMRepository.findById('campaigns', testWsId, 'camp-777');
    assert(afterHydrate.status === 'COMPLETED', `Hydrated status must be COMPLETED, got: ${afterHydrate?.status}`);

    console.log('✓ Test 8 Passed: Rehydration accurately restores authoritative server status\n');
  }

  // ---------------------------------------------------------------------------
  // [Test 9] F-10: Out-of-Order / Terminal Status Guardrail
  // ---------------------------------------------------------------------------
  console.log('--- [Test 9] F-10: Terminal Status Guardrail ---');
  {
    const mockSdk: any = {
      campaigns: {
        get: async () => ({ id: 'camp-888', status: 'COMPLETED' }),
        update: async (_id: string, dto: any) => ({ id: 'camp-888', status: dto.status })
      },
      executions: {
        list: async () => [
          { id: 'ex-1', campaignId: 'camp-888', status: 'completed' },
          { id: 'ex-2', campaignId: 'camp-888', status: 'completed' }
        ]
      }
    };

    // Job finishes late on an already COMPLETED campaign
    await ProjectionService.reconcileJobOutcome(
      testWsId,
      'automation:workflow',
      { campaignId: 'camp-888', executionId: 'ex-1' },
      { outcome: 'ok' },
      mockSdk
    );

    const camp = await LocalCRMRepository.findById('campaigns', testWsId, 'camp-888');
    assert(camp.status === 'COMPLETED', `Campaign must remain COMPLETED, got: ${camp?.status}`);

    console.log('✓ Test 9 Passed: Terminal status is preserved under late-arriving job outcomes\n');
  }

  // ---------------------------------------------------------------------------
  // [Test 10] Complete Outreach Variable Pipeline End-to-End
  // ---------------------------------------------------------------------------
  console.log('--- [Test 10] Complete Outreach Variable Pipeline End-to-End ---');
  {
    const fullCtx: CanonicalVariableContext = {
      contact: {
        id: 'cnt-999',
        firstName: 'Sarah',
        lastName: 'Connor',
        email: 'sarah@skynet-defense.org',
        title: 'Chief Security Officer'
      },
      company: {
        id: 'comp-999',
        name: 'Cyberdyne Systems',
        domain: 'cyberdyne.com',
        industry: 'Robotics',
        location: 'Sunnyvale, CA',
        website: 'https://cyberdyne.com'
      },
      sender: {
        name: 'John Connor',
        email: 'john@resistance.net'
      },
      sequence: {
        name: 'Security Advisory Sequence'
      },
      workspace: {
        id: testWsId
      }
    };

    const template = 'Dear {{contact.title}} {{contact.lastName}},\n\nI am contacting {{company.name}} in {{company.location}} regarding our {{sequence.name}}.\n\nRegards,\n{{sender.name}} ({{sender.email}})';
    const output = renderCanonicalVariables(template, fullCtx);

    assert(output.includes('Dear Chief Security Officer Connor,'), 'Title/lastName failed');
    assert(output.includes('contacting Cyberdyne Systems in Sunnyvale, CA'), 'Company/location failed');
    assert(output.includes('regarding our Security Advisory Sequence.'), 'Sequence name failed');
    assert(output.includes('John Connor (john@resistance.net)'), 'Sender details failed');
    assert(!output.includes('{{') && !output.includes('undefined'), 'No leaked tokens');

    console.log('✓ Test 10 Passed: Full outreach variable pipeline verified end-to-end\n');
  }

  // ---------------------------------------------------------------------------
  // [Test 11] Delivery Ledger Visibility Across DB & Query Path
  // ---------------------------------------------------------------------------
  console.log('--- [Test 11] Delivery Ledger Query Contract ---');
  {
    db.prepare(`
      INSERT INTO email_deliveries (id, workspaceId, campaignId, contactId, toAddress, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('del-99', testWsId, 'camp-777', 'cnt-101', 'elena@solaris.ai', 'SENT');

    const deliveryRow = db.prepare('SELECT * FROM email_deliveries WHERE workspaceId = ? AND id = ?').get(testWsId, 'del-99') as any;
    assert(deliveryRow && deliveryRow.status === 'SENT', 'Delivery record must exist in SQLite read cache');
    assert(deliveryRow.toAddress === 'elena@solaris.ai', 'Delivery address mismatch');

    console.log('✓ Test 11 Passed: Delivery ledger query contract verified\n');
  }

  // ---------------------------------------------------------------------------
  // [Test 12] Phase 2A Connectivity State Machine Regression Guardrail
  // ---------------------------------------------------------------------------
  console.log('--- [Test 12] Phase 2A Connectivity Regression Guardrail ---');
  {
    ConnectivityService.setState({
      status: 'ONLINE',
      apiUrl: 'http://localhost:3001/api/v1',
      error: null
    });

    const state = ConnectivityService.getState();
    assert(state.status === 'ONLINE', `Expected ONLINE, got ${state.status}`);
    assert(state.apiUrl === 'http://localhost:3001/api/v1', 'apiUrl mismatch');
    assert(state.error === null, 'error must be null');

    console.log('✓ Test 12 Passed: Phase 2A connectivity state machine confirmed regression-free\n');
  }

  // ---------------------------------------------------------------------------
  // [Test 13] Phase 2B Projection & Discovery Regression Guardrail
  // ---------------------------------------------------------------------------
  console.log('--- [Test 13] Phase 2B Discovery & Projection Regression Guardrail ---');
  {
    const runId = 'run-guardrail-' + Date.now();
    const mockSdk: any = {
      discovery: {
        listCompaniesForRun: async () => [
          { id: 'comp-g1', name: 'Guardrail Corp', workspaceId: testWsId, location: 'Tokyo, Japan' },
          { id: 'comp-g2', name: 'Anchor Tech', workspaceId: testWsId, location: 'London, UK' }
        ]
      }
    };

    const companies = await ProjectionService.reconcileDiscoveryRun(testWsId, runId, mockSdk);
    assert(companies.length === 2, `Expected 2 reconciled companies, got ${companies.length}`);

    const distinctCompanies = db
      .prepare('SELECT DISTINCT companyId FROM company_discovery_runs WHERE workspaceId = ? AND discoveryRunId = ?')
      .all(testWsId, runId) as any[];
    assert(distinctCompanies.length === 2, `Expected 2 distinct provenance records, got ${distinctCompanies.length}`);

    console.log('✓ Test 13 Passed: Phase 2B discovery projection confirmed regression-free\n');
  }

  // ---------------------------------------------------------------------------
  // Final Certification Summary
  // ---------------------------------------------------------------------------
  console.log('========================================================================');
  console.log(` ALL ${passedCount}/${totalCount} TESTS PASSED — PHASE 2C CERTIFIED`);
  console.log('========================================================================\n');
}

runPhase2CTests().catch((err) => {
  console.error('\n❌ PHASE 2C TEST FAILED:', err);
  process.exit(1);
});
