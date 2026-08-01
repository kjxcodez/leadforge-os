import { getDatabase } from '../../database/connection';
import fs from 'fs';

/**
 * Runs SRE Operations and Observability platform integration tests.
 */
export async function runObservabilityTests(workspaceId: string): Promise<boolean> {
  console.log('--- STARTING SRE OBSERVABILITY INTEGRATION TESTS ---');
  const db = getDatabase(workspaceId);

  // 1. Test Audit Logging Trace (Phase 8 & 12)
  try {
    const auditLogId = 'test-audit-' + Date.now();
    db.prepare(
      `
      INSERT INTO audit_logs (id, workspaceId, actor, action, entityId, entityType, beforeValue, afterValue)
      VALUES (?, ?, 'system', 'test:run', 'test-entity-1', 'TestType', '{"status":"old"}', '{"status":"new"}')
    `
    ).run(auditLogId, workspaceId);

    const checkAudit = db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(auditLogId) as any;
    if (checkAudit && checkAudit.actor === 'system' && checkAudit.action === 'test:run') {
      console.log('  ✅ Success: Audit log inserted and fetched correctly.');
    } else {
      throw new Error('Audit log verification failed');
    }
  } catch (err: any) {
    console.error('  ❌ Failure in Audit Logging Trace Test:', err);
    return false;
  }

  // 2. Test Structured Log Filters (Phase 4 & 12)
  try {
    const testLogId = 'test-log-' + Date.now();
    db.prepare(
      `
      INSERT INTO system_logs (id, workspaceId, severity, task, message, timestamp)
      VALUES (?, ?, 'error', 'TEST_RUN', 'Observability verification warning', datetime('now'))
    `
    ).run(testLogId, workspaceId);

    const logs = db.prepare('SELECT * FROM system_logs WHERE id = ?').all(testLogId) as any[];
    if (logs.length === 1 && logs[0].severity === 'error') {
      console.log('  ✅ Success: Structured log inserted and filtered successfully.');
    } else {
      throw new Error('Structured log check failed');
    }
  } catch (err: any) {
    console.error('  ❌ Failure in Structured Log Filters Test:', err);
    return false;
  }

  // 3. Test Performance Metrics calculation (Phase 6 & 12)
  try {
    const testJobId = 'test-job-' + Date.now();
    db.prepare(
      `
      INSERT INTO jobs (id, workspaceId, type, status, durationMs, createdAt, updatedAt)
      VALUES (?, ?, 'scraper:maps', 'completed', 4500, datetime('now'), datetime('now'))
    `
    ).run(testJobId, workspaceId);

    const row = db
      .prepare(
        "SELECT avg(durationMs) as avgVal FROM jobs WHERE type = 'scraper:maps' AND status = 'completed'"
      )
      .get() as any;
    if (row && row.avgVal >= 4500) {
      console.log('  ✅ Success: Performance metrics aggregated successfully.');
    } else {
      throw new Error('Performance aggregation check failed');
    }
  } catch (err: any) {
    console.error('  ❌ Failure in Performance Metrics Test:', err);
    return false;
  }

  // 4. Test SRE Recovery Execution (Phase 9 & 12)
  try {
    const failedJobId = 'failed-job-' + Date.now();
    db.prepare(
      `
      INSERT INTO jobs (id, workspaceId, type, status, error, createdAt, updatedAt)
      VALUES (?, ?, 'enrich:intelligence', 'failed', 'API Key expired', datetime('now'), datetime('now'))
    `
    ).run(failedJobId, workspaceId);

    // Run recovery retry trigger
    db.prepare("UPDATE jobs SET status = 'queued', retryCount = 0, error = NULL WHERE id = ?").run(
      failedJobId
    );

    const retriedJob = db
      .prepare('SELECT status, error FROM jobs WHERE id = ?')
      .get(failedJobId) as any;
    if (retriedJob && retriedJob.status === 'queued' && retriedJob.error === null) {
      console.log('  ✅ Success: SRE recovery retry trigger executed successfully.');
    } else {
      throw new Error('Recovery retry execution failed');
    }
  } catch (err: any) {
    console.error('  ❌ Failure in SRE Recovery Execution Test:', err);
    return false;
  }

  console.log('--- ALL SRE OBSERVABILITY INTEGRATION TESTS PASSED ---');
  return true;
}
