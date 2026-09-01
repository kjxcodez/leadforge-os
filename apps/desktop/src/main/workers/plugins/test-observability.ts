import { getDatabase } from '../../database/connection';

/**
 * Runs SRE Operations and Observability platform integration tests against active cache tables.
 */
export async function runObservabilityTests(workspaceId: string): Promise<boolean> {
  console.log('--- STARTING SRE OBSERVABILITY INTEGRATION TESTS ---');
  const db = getDatabase(workspaceId);

  // 1. Test Cache Database Write & Read Trace
  try {
    const testSettingKey = 'test_diag_' + Date.now();
    db.prepare(
      `
      INSERT INTO settings (id, workspaceId, key, value, createdAt, updatedAt)
      VALUES (?, ?, ?, 'diag_ok', datetime('now'), datetime('now'))
    `
    ).run('sett-' + Date.now(), workspaceId, testSettingKey);

    const checkSetting = db
      .prepare('SELECT value FROM settings WHERE workspaceId = ? AND key = ?')
      .get(workspaceId, testSettingKey) as any;
    if (checkSetting && checkSetting.value === 'diag_ok') {
      console.log('  ✅ Success: Cache database write and read verified.');
    } else {
      throw new Error('Cache settings verification failed');
    }
  } catch (err: any) {
    console.error('  ❌ Failure in Cache Write/Read Test:', err);
    return false;
  }

  // 2. Test Contact Cache Query
  try {
    const contactsCount = db
      .prepare('SELECT COUNT(*) as count FROM contacts WHERE workspaceId = ? AND deletedAt IS NULL')
      .get(workspaceId) as any;
    if (typeof contactsCount?.count === 'number') {
      console.log('  ✅ Success: Contacts cache query verified.');
    } else {
      throw new Error('Contacts count query failed');
    }
  } catch (err: any) {
    console.error('  ❌ Failure in Contacts Cache Query Test:', err);
    return false;
  }

  // 3. Test Sequence Executions Cache Query
  try {
    const execCount = db
      .prepare('SELECT COUNT(*) as count FROM sequence_executions WHERE workspaceId = ? AND deletedAt IS NULL')
      .get(workspaceId) as any;
    if (typeof execCount?.count === 'number') {
      console.log('  ✅ Success: Sequence executions cache query verified.');
    } else {
      throw new Error('Sequence executions query failed');
    }
  } catch (err: any) {
    console.error('  ❌ Failure in Sequence Executions Cache Test:', err);
    return false;
  }

  console.log('--- ALL SRE OBSERVABILITY INTEGRATION TESTS PASSED ---');
  return true;
}
