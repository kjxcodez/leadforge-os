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

    const totalCompanies = (
      db
        .prepare(
          'SELECT COUNT(*) as count FROM companies WHERE workspaceId = ? AND deletedAt IS NULL'
        )
        .get(workspaceId) as any
    ).count;
    const totalContacts = (
      db
        .prepare(
          'SELECT COUNT(*) as count FROM contacts WHERE workspaceId = ? AND deletedAt IS NULL'
        )
        .get(workspaceId) as any
    ).count;
    const totalCampaigns = (
      db
        .prepare(
          'SELECT COUNT(*) as count FROM campaigns WHERE workspaceId = ? AND deletedAt IS NULL'
        )
        .get(workspaceId) as any
    ).count;

    // Enrollment metrics (sequence_executions)
    let executionStats: any = {
      waiting: 0,
      running: 0,
      replied: 0,
      failed: 0,
      paused: 0,
      completed: 0
    };
    try {
      executionStats = (db
        .prepare(
          `
        SELECT 
          SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) as waiting,
          SUM(CASE WHEN status IN ('running', 'queued', 'starting') THEN 1 ELSE 0 END) as running,
          SUM(CASE WHEN status IN ('replied', 'REPLIED') THEN 1 ELSE 0 END) as replied,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) as paused,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
        FROM sequence_executions
        WHERE workspaceId = ? AND deletedAt IS NULL
      `
        )
        .get(workspaceId) || executionStats) as any;
    } catch {}

    // Today's Sends (query deliveries via SDK or execution stats fallback)
    let todaySends = 0;
    let totalJobs = 0;
    let queuedJobs = 0;

    const runtime = WorkspaceManager.getActiveRuntime();
    const sdk = WorkspaceManager.getSdk();

    try {
      const today = new Date().toISOString().split('T')[0];
      const deliveries = await sdk.emailDeliveries.list({ limit: 100, status: 'SENT' }).catch(() => ({ data: [], total: 0 }));
      if (deliveries && Array.isArray(deliveries.data)) {
        todaySends = deliveries.data.filter(
          (d: any) => d.sentAt && d.sentAt.toString().startsWith(today)
        ).length;
      }
    } catch {}

    // Jobs and Queue Size from in-memory scheduler or API
    if (runtime && runtime.workspaceId === workspaceId) {
      const scheduler = runtime.scheduler as any;
      const activeWorkerCount = scheduler?.activeWorkers?.size || 0;
      totalJobs = activeWorkerCount;
      queuedJobs = 0;
    }

    // SMTP & IMAP Status (from email_accounts cache)
    let emailStatus = 'disconnected';
    try {
      const emailAccount = db
        .prepare(
          `
        SELECT status FROM email_accounts 
        WHERE workspaceId = ? AND deletedAt IS NULL
        ORDER BY createdAt ASC LIMIT 1
      `
        )
        .get(workspaceId) as { status: string } | undefined;
      emailStatus = emailAccount?.status || 'disconnected';
    } catch {}

    return {
      totalCompanies: totalCompanies || 0,
      totalContacts: totalContacts || 0,
      totalCampaigns: totalCampaigns || 0,
      todaySends: todaySends || 0,
      waitingCount: executionStats?.waiting || 0,
      runningCount: executionStats?.running || 0,
      repliedCount: executionStats?.replied || 0,
      failedCount: executionStats?.failed || 0,
      pausedCount: executionStats?.paused || 0,
      completedCount: executionStats?.completed || 0,
      totalJobs,
      queueSize: queuedJobs,
      syncQueueCount: 0,
      smtpStatus: emailStatus,
      imapStatus: emailStatus
    };
  });

  // 2. Dashboard Activity Feed (authoritative from API system-logs & executions)
  safeRegister('dashboard:activity-feed', async (_event, { workspaceId, limit = 50 }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    const sdk = WorkspaceManager.getSdk();

    try {
      const logs = await sdk.systemLogs.listRecent(limit).catch(() => []);

      return (logs || []).map((l: any) => ({
        id: l.id || l._id || Math.random().toString(),
        log_type: 'system',
        type: l.severity || l.category || 'info',
        message: l.message || 'Operation executed',
        timestamp: l.timestamp || l.createdAt || new Date().toISOString(),
        entity: l.context?.service || 'system',
        status: l.severity === 'error' || l.severity === 'fatal' ? 'error' : 'success'
      }));
    } catch {
      return [];
    }
  });

  // 3. Dashboard Chart Data (deliveries + cached contacts & executions)
  safeRegister('dashboard:chart-data', async (_event, { workspaceId, days = 7 }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    const db = getDatabase(workspaceId);
    const sdk = WorkspaceManager.getSdk();

    const resultList: any[] = [];
    const dateMap = new Map<
      string,
      { emailsSent: number; contactsCreated: number; executions: number }
    >();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split('T')[0] || '';
      dateMap.set(dayStr, { emailsSent: 0, contactsCreated: 0, executions: 0 });
    }

    const startDateStr = (Array.from(dateMap.keys())[0] || '') + ' 00:00:00';

    // Emails sent from API deliveries
    try {
      const deliveries = await sdk.emailDeliveries.list({ limit: 100, status: 'SENT' }).catch(() => ({ data: [], total: 0 }));
      if (deliveries && Array.isArray(deliveries.data)) {
        for (const delivery of deliveries.data) {
          const sentDay = delivery.sentAt ? new Date(delivery.sentAt).toISOString().split('T')[0] : '';
          if (sentDay && dateMap.has(sentDay)) {
            dateMap.get(sentDay)!.emailsSent += 1;
          }
        }
      }
    } catch {}

    // Contacts created
    try {
      const contacts = db
        .prepare(
          `
        SELECT date(createdAt) as day, COUNT(*) as count
        FROM contacts
        WHERE workspaceId = ? AND deletedAt IS NULL AND createdAt >= ?
        GROUP BY day
      `
        )
        .all(workspaceId, startDateStr) as Array<{ day: string; count: number }>;
      for (const row of contacts) {
        if (row.day && dateMap.has(row.day)) {
          dateMap.get(row.day)!.contactsCreated = row.count;
        }
      }
    } catch {}

    // Automation executions started
    try {
      const executions = db
        .prepare(
          `
        SELECT date(startedAt) as day, COUNT(*) as count
        FROM sequence_executions
        WHERE workspaceId = ? AND startedAt >= ?
        GROUP BY day
      `
        )
        .all(workspaceId, startDateStr) as Array<{ day: string; count: number }>;
      for (const row of executions) {
        if (row.day && dateMap.has(row.day)) {
          dateMap.get(row.day)!.executions = row.count;
        }
      }
    } catch {}

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
      cacheHydrator: {
        status: 'Ready',
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
      const schedulerState = scheduler ? scheduler.getState() : 'STOPPED';
      const isSchedulerRunning = scheduler ? scheduler.isActive : false;
      const schedulerStatus = isSchedulerRunning
        ? schedulerState === 'ACTIVE' || schedulerState === 'IDLE' || schedulerState === 'BACKING_OFF'
          ? 'Running'
          : schedulerState
        : 'Stopped';

      stats.scheduler = {
        status: schedulerStatus,
        state: schedulerState,
        uptimeMs: runtime.startedAt ? Date.now() - runtime.startedAt.getTime() : 0,
        latencyMs: 10,
        restartCount: runtime.restartCount
      };

      // Cache Hydrator
      stats.cacheHydrator = {
        status: 'Ready',
        uptimeMs: runtime.startedAt ? Date.now() - runtime.startedAt.getTime() : 0,
        lastHeartbeat: new Date().toISOString()
      };

      // Automation Runtime
      const triggerEvaluator = runtime.triggerEvaluator as any;
      const isEvaluatorRunning = triggerEvaluator
        ? triggerEvaluator.isRunning ?? (triggerEvaluator.unsubscribers && triggerEvaluator.unsubscribers.length > 0)
        : false;
      stats.automationRuntime = {
        status: isEvaluatorRunning ? 'Running' : 'Stopped',
        uptimeMs: runtime.startedAt ? Date.now() - runtime.startedAt.getTime() : 0
      };

      // Worker Host (from scheduler active workers)
      const workerCount = scheduler
        ? (scheduler.activeWorkerCount ?? (scheduler.activeWorkers ? scheduler.activeWorkers.size : 0))
        : 0;
      stats.workerHost = {
        status: workerCount > 0 ? 'Running' : isSchedulerRunning ? 'Running' : 'Stopped',
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
