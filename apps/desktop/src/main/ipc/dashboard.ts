import { safeRegister } from './helper';
import { getDatabase } from '../database/connection';
import { WorkspaceManager } from '../lib/workspace-manager';

/**
 * Registers dashboard telemetry, stats, and real-time infrastructure tracking IPC channels.
 */
export function registerDashboardIpc(): void {
  // 1. Dashboard counts stats
  safeRegister('dashboard:stats', async (_event, { workspaceId }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    const db = getDatabase(workspaceId);
    
    const totalCompanies = (db.prepare('SELECT COUNT(*) as count FROM companies WHERE workspaceId = ? AND deletedAt IS NULL').get(workspaceId) as any).count;
    const totalContacts = (db.prepare('SELECT COUNT(*) as count FROM contacts WHERE workspaceId = ? AND deletedAt IS NULL').get(workspaceId) as any).count;
    const totalCampaigns = (db.prepare('SELECT COUNT(*) as count FROM campaigns WHERE workspaceId = ? AND deletedAt IS NULL').get(workspaceId) as any).count;
    const totalExecutions = (db.prepare('SELECT COUNT(*) as count FROM sequence_executions WHERE workspaceId = ? AND deletedAt IS NULL').get(workspaceId) as any).count;
    
    return {
      totalCompanies,
      totalContacts,
      totalCampaigns,
      totalExecutions
    };
  });

  // 2. Dashboard Activity Feed
  safeRegister('dashboard:activity-feed', async (_event, { workspaceId, limit = 50 }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    const db = getDatabase(workspaceId);
    
    const rows = db.prepare(`
      SELECT 'activity' as log_type, id, type, content as message, createdAt as timestamp, 'crm' as entity, 'success' as status
      FROM activities
      WHERE workspaceId = ?
      UNION ALL
      SELECT 'sequence' as log_type, id, action as type, message, timestamp, 'automation' as entity, status
      FROM sequence_logs
      WHERE workspaceId = ?
      UNION ALL
      SELECT 'system' as log_type, id, severity as type, message, timestamp, task as entity, 'info' as status
      FROM system_logs
      WHERE workspaceId = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(workspaceId, workspaceId, workspaceId, limit);
    
    return rows;
  });

  // 3. Dashboard Chart Data
  safeRegister('dashboard:chart-data', async (_event, { workspaceId, days = 7 }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    const db = getDatabase(workspaceId);
    
    const resultList: any[] = [];
    const dateMap = new Map<string, { emailsSent: number; contactsCreated: number; executions: number }>();
    
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split('T')[0] || '';
      dateMap.set(dayStr, { emailsSent: 0, contactsCreated: 0, executions: 0 });
    }

    const startDateStr = (Array.from(dateMap.keys())[0] || '') + ' 00:00:00';

    // Emails sent (sequence_logs)
    const emails = db.prepare(`
      SELECT date(timestamp) as day, COUNT(*) as count
      FROM sequence_logs
      WHERE workspaceId = ? AND action = 'EMAIL_SEND' AND status = 'success' AND timestamp >= ?
      GROUP BY day
    `).all(workspaceId, startDateStr) as Array<{ day: string; count: number }>;
    for (const row of emails) {
      if (row.day && dateMap.has(row.day)) {
        dateMap.get(row.day)!.emailsSent = row.count;
      }
    }

    // Contacts created
    const contacts = db.prepare(`
      SELECT date(createdAt) as day, COUNT(*) as count
      FROM contacts
      WHERE workspaceId = ? AND deletedAt IS NULL AND createdAt >= ?
      GROUP BY day
    `).all(workspaceId, startDateStr) as Array<{ day: string; count: number }>;
    for (const row of contacts) {
      if (row.day && dateMap.has(row.day)) {
        dateMap.get(row.day)!.contactsCreated = row.count;
      }
    }

    // Automation executions started
    const executions = db.prepare(`
      SELECT date(startedAt) as day, COUNT(*) as count
      FROM sequence_executions
      WHERE workspaceId = ? AND startedAt >= ?
      GROUP BY day
    `).all(workspaceId, startDateStr) as Array<{ day: string; count: number }>;
    for (const row of executions) {
      if (row.day && dateMap.has(row.day)) {
        dateMap.get(row.day)!.executions = row.count;
      }
    }

    for (const [day, val] of dateMap.entries()) {
      resultList.push({
        day,
        ...val
      });
    }

    return resultList;
  });

  // 4. Infrastructure Status Tracker
  safeRegister('system:infrastructure-status', async (_event, { workspaceId }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    
    const runtime = WorkspaceManager.getActiveRuntime();
    const stats: any = {
      workspaceId,
      scheduler: {
        status: 'Stopped',
        uptimeMs: 0,
        latencyMs: 15,
        restartCount: 0
      },
      syncEngine: {
        status: 'Stopped',
        uptimeMs: 0,
        lastHeartbeat: null
      },
      automationRuntime: {
        status: 'Stopped',
        uptimeMs: 0
      },
      workerHost: {
        status: 'Stopped',
        activeWorkers: 0
      },
      ipcBridge: {
        status: 'Running'
      },
      database: {
        status: 'Connected'
      },
      workspaceRuntime: {
        status: 'Stopped',
        uptimeMs: 0,
        startupDuration: 0,
        restartCount: 0,
        memoryUsage: 0,
        averageStartupTime: 0
      }
    };

    if (runtime && runtime.workspaceId === workspaceId) {
      // Scheduler
      const scheduler = runtime.scheduler as any;
      const isSchedulerRunning = !!scheduler.intervalId;
      stats.scheduler = {
        status: isSchedulerRunning ? 'Running' : 'Stopped',
        uptimeMs: runtime.startedAt ? Date.now() - runtime.startedAt.getTime() : 0,
        latencyMs: 10,
        restartCount: runtime.restartCount
      };

      // Sync Engine
      const syncEngine = runtime.syncEngine as any;
      const isSyncRunning = !!syncEngine.intervalId;
      stats.syncEngine = {
        status: isSyncRunning ? 'Running' : 'Stopped',
        uptimeMs: runtime.startedAt ? Date.now() - runtime.startedAt.getTime() : 0,
        lastHeartbeat: new Date().toISOString()
      };

      // Automation Runtime
      const triggerEvaluator = runtime.triggerEvaluator as any;
      const isEvaluatorRunning = triggerEvaluator.unsubscribers && triggerEvaluator.unsubscribers.length > 0;
      stats.automationRuntime = {
        status: isEvaluatorRunning ? 'Running' : 'Stopped',
        uptimeMs: runtime.startedAt ? Date.now() - runtime.startedAt.getTime() : 0
      };

      // Worker Host (from scheduler active workers)
      const workerCount = scheduler.activeWorkers ? scheduler.activeWorkers.size : 0;
      stats.workerHost = {
        status: workerCount > 0 ? 'Running' : (isSchedulerRunning ? 'Running' : 'Stopped'),
        activeWorkers: workerCount
      };

      // Workspace Runtime metrics (PRD-002)
      const lifecycle = WorkspaceManager.getLifecycleMetrics();
      stats.workspaceRuntime = {
        status: 'Running',
        uptimeMs: runtime.startedAt ? Date.now() - runtime.startedAt.getTime() : 0,
        startupDuration: (runtime as any).startupDuration || 0,
        restartCount: runtime.restartCount,
        memoryUsage: process.memoryUsage().heapUsed,
        averageStartupTime: lifecycle.averageStartupTime
      };
    }

    return stats;
  });
}
