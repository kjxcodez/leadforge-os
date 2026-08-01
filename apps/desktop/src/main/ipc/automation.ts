import { safeRegister } from './helper';
import { SdkClient } from '@leadforge/sdk';
import { WorkspaceManager } from '../lib/workspace-manager';
import { LocalCRMRepository } from '../database/repositories/local-crm';
import { randomUUID } from 'crypto';

/**
 * Registers sequences and executions automation IPC channels.
 */
export function registerAutomationIpc(sdk: SdkClient) {
  // Sequences CRUD
  safeRegister('sequence:list', async () => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    try {
      const list = await sdk.sequences.list();
      await LocalCRMRepository.saveMany(
        'sequences',
        list.map((item) => ({ ...item, workspaceId: runtime.workspaceId })),
        true
      );
      return list;
    } catch (err) {
      console.warn('[IPC] Failed to list sequences from remote, falling back to local cache:', err);
      return LocalCRMRepository.findMany('sequences', runtime.workspaceId);
    }
  });

  safeRegister('sequence:get', async (_event, id) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    try {
      const res = await sdk.sequences.get(id);
      await LocalCRMRepository.save(
        'sequences',
        { ...res, workspaceId: runtime.workspaceId },
        true
      );
      return res;
    } catch (err) {
      const cached = await LocalCRMRepository.findById('sequences', runtime.workspaceId, id);
      if (!cached) throw err;
      return cached;
    }
  });

  safeRegister('sequence:create', async (_event, dto) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    const id = dto.id || randomUUID();
    const record = { ...dto, id, workspaceId: runtime.workspaceId, syncStatus: 'pending' };
    await LocalCRMRepository.save('sequences', record);
    return record;
  });

  safeRegister('sequence:update', async (_event, { id, dto }) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    const record = { ...dto, id, workspaceId: runtime.workspaceId, syncStatus: 'pending' };
    await LocalCRMRepository.save('sequences', record);
    return record;
  });

  safeRegister('sequence:delete', async (_event, id) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');
    await LocalCRMRepository.softDelete('sequences', runtime.workspaceId, id);
    return { success: true };
  });

  // Executions Orchestration — Local-First Desktop Scheduler Engine
  safeRegister('sequence:start', async (_event, { sequenceId, contactId, companyId }) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');

    // 1. Verify sequence template availability locally (fetch remote fallback if missing)
    let sequence = await LocalCRMRepository.findById('sequences', runtime.workspaceId, sequenceId);
    if (!sequence) {
      try {
        sequence = await sdk.sequences.get(sequenceId);
        if (sequence) {
          await LocalCRMRepository.save(
            'sequences',
            { ...sequence, workspaceId: runtime.workspaceId },
            true
          );
        }
      } catch (err) {
        console.warn('[IPC] Could not fetch sequence template from remote:', err);
      }
    }

    const executionId = randomUUID();
    const now = new Date().toISOString();
    const entityId = contactId || companyId || '';
    const entityType = contactId ? 'contact' : companyId ? 'company' : '';

    const executionRecord = {
      id: executionId,
      sequenceId,
      workspaceId: runtime.workspaceId,
      contactId: contactId || null,
      companyId: companyId || null,
      currentStep: 0,
      status: 'queued',
      startedAt: now,
      logs: JSON.stringify([]),
      syncStatus: 'pending',
      createdAt: now,
      updatedAt: now
    };

    // 2. Write execution record into local SQLite database (syncStatus = pending triggers background SyncEngine)
    await LocalCRMRepository.save('sequence_executions', executionRecord);

    // 3. Enqueue automation:workflow job in local SQLite jobs table for desktop JobScheduler & JobWorker
    const jobId = randomUUID();
    const jobPayload = JSON.stringify({
      sequenceId,
      entityId,
      entityType,
      executionId,
      workspaceId: runtime.workspaceId
    });

    const stmtInsertJob = runtime.sqliteDb.prepare(`
      INSERT INTO jobs (id, workspaceId, type, status, priority, payload, progress, retryCount, maxRetries, createdAt, updatedAt)
      VALUES (?, ?, 'automation:workflow', 'queued', 3, ?, 0, 0, 3, datetime('now'), datetime('now'))
    `);
    stmtInsertJob.run(jobId, runtime.workspaceId, jobPayload);

    return executionRecord;
  });

  safeRegister('sequence:stop', async (_event, id) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');

    const now = new Date().toISOString();
    const current = await LocalCRMRepository.findById(
      'sequence_executions',
      runtime.workspaceId,
      id
    );

    const updatedRecord = {
      ...(current || {}),
      id,
      workspaceId: runtime.workspaceId,
      status: 'cancelled',
      completedAt: now,
      cancelledAt: now,
      syncStatus: 'pending',
      updatedAt: now
    };

    // 1. Update status in local SQLite database
    await LocalCRMRepository.save('sequence_executions', updatedRecord);

    // 2. Cancel matching active workflow jobs in local SQLite jobs table
    try {
      const stmtCancelJob = runtime.sqliteDb.prepare(`
        UPDATE jobs
        SET status = 'cancelled', updatedAt = datetime('now')
        WHERE workspaceId = ?
          AND type = 'automation:workflow'
          AND (json_extract(payload, '$.executionId') = ? OR json_extract(payload, '$.sequenceId') = ?)
          AND status IN ('queued', 'starting', 'running', 'retrying')
      `);
      stmtCancelJob.run(runtime.workspaceId, id, current?.sequenceId || '');
    } catch (err) {
      console.warn('[IPC] Error cancelling local automation job:', err);
    }

    return updatedRecord;
  });

  safeRegister('execution:list', async () => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');

    // 1. Read directly from local SQLite database (local-first)
    const localList = await LocalCRMRepository.findMany('sequence_executions', runtime.workspaceId);

    // 2. Background non-blocking remote sync pull
    sdk.executions
      .list()
      .then(async (remoteList) => {
        if (Array.isArray(remoteList)) {
          await LocalCRMRepository.saveMany(
            'sequence_executions',
            remoteList.map((item) => ({ ...item, workspaceId: runtime.workspaceId })),
            true
          );
        }
      })
      .catch((err) => {
        console.warn('[IPC] Remote executions pull skipped:', err.message);
      });

    return localList;
  });

  safeRegister('execution:get', async (_event, id) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');

    // Read directly from local SQLite database first
    const cached = await LocalCRMRepository.findById(
      'sequence_executions',
      runtime.workspaceId,
      id
    );
    if (cached) return cached;

    try {
      const res = await sdk.executions.get(id);
      if (res) {
        await LocalCRMRepository.save(
          'sequence_executions',
          { ...res, workspaceId: runtime.workspaceId },
          true
        );
      }
      return res;
    } catch (err) {
      return null;
    }
  });

  safeRegister('execution:logs', async (_event, id) => {
    const runtime = WorkspaceManager.getActiveRuntime();
    if (!runtime) throw new Error('No active workspace runtime');

    // 1. Query local SQLite sequence_logs table first
    try {
      const stmtLogs = runtime.sqliteDb.prepare(`
        SELECT * FROM sequence_logs
        WHERE workspaceId = ? AND executionId = ?
        ORDER BY timestamp ASC
      `);
      const localLogs = stmtLogs.all(runtime.workspaceId, id);
      if (localLogs && localLogs.length > 0) {
        return localLogs;
      }
    } catch (err) {
      console.warn('[IPC] Error querying local sequence_logs:', err);
    }

    // 2. Fallback to parsing embedded logs column on sequence_executions record
    const execRecord = await LocalCRMRepository.findById(
      'sequence_executions',
      runtime.workspaceId,
      id
    );
    if (execRecord?.logs) {
      try {
        const parsed =
          typeof execRecord.logs === 'string' ? JSON.parse(execRecord.logs) : execRecord.logs;
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }

    // 3. Fallback to remote SDK if offline cache is empty
    try {
      return await sdk.executions.getLogs(id);
    } catch {
      return [];
    }
  });
}
