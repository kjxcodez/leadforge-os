import { app, BrowserWindow } from 'electron';
import fs from 'fs';
import { join } from 'path';
import { getDatabase } from '../database/connection';

export interface LogRecord {
  id: string;
  workspaceId: string;
  workerId?: string | null;
  severity: 'info' | 'warn' | 'error';
  task: string;
  message: string;
  durationMs?: number | null;
  metadata?: any;
  timestamp: string;
}

/**
 * AppLoggerClass manages structured system logging to stdout, local SQLite,
 * rotating filesystem files, and real-time IPC broadcasts.
 */
class AppLoggerClass {
  private logDir: string = '';
  private memoryLogs: LogRecord[] = [];

  constructor() {
    try {
      this.logDir = join(app.getPath('userData'), 'logs');
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
      this.pruneOldLogFiles();
    } catch (e) {
      // app context might be missing in test environments
    }
  }

  /**
   * Logs a message into terminal console, database table system_logs, and rotating files.
   */
  public log(params: {
    workspaceId?: string | undefined;
    workerId?: string | undefined;
    severity: 'info' | 'warn' | 'error';
    task: string;
    message: string;
    durationMs?: number | undefined;
    metadata?: any;
  }): void {
    const workspaceId = params.workspaceId || 'global';
    const logId = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : require('crypto').randomUUID();
    const timestamp = new Date().toISOString();

    const record: LogRecord = {
      id: logId,
      workspaceId,
      workerId: params.workerId || null,
      severity: params.severity,
      task: params.task,
      message: params.message,
      durationMs: params.durationMs || null,
      metadata: params.metadata || null,
      timestamp
    };

    // 0. In-memory circular buffer
    this.memoryLogs.push(record);
    if (this.memoryLogs.length > 500) {
      this.memoryLogs.shift();
    }

    // 1. Standard Streams
    const consoleMsg = `[${timestamp}] [${record.severity.toUpperCase()}] [${record.task}] ${record.message}`;
    if (record.severity === 'error') {
      console.error(consoleMsg);
    } else if (record.severity === 'warn') {
      console.warn(consoleMsg);
    } else {
      console.log(consoleMsg);
    }

    // 2. Rotating file system JSONL write
    if (this.logDir) {
      try {
        const today = new Date().toISOString().split('T')[0];
        const logFilename = `leadforge_${workspaceId}_${today}.jsonl`;
        const filePath = join(this.logDir, logFilename);
        fs.appendFileSync(filePath, JSON.stringify(record) + '\n', 'utf8');
      } catch (err) {
        console.error('[Logger] Failed to write log to rotation file:', err);
      }
    }

    // 3. Dev Mode event stream
    try {
      const { logDevModeEvent } = require('../ipc/observability-ipc');
      if (typeof logDevModeEvent === 'function') {
        logDevModeEvent('LOG', `[${record.severity.toUpperCase()}] [${record.task}] ${record.message}`, record);
      }
    } catch {}

    // 4. Asynchronously append to authoritative MongoDB system-logs
    if (workspaceId && workspaceId !== 'global') {
      try {
        const { WorkspaceManager } = require('./workspace-manager');
        const sdk = WorkspaceManager.getSdk();
        if (sdk && typeof sdk.systemLogs?.append === 'function') {
          sdk.systemLogs
            .append({
              workspaceId,
              severity: record.severity,
              task: record.task,
              message: record.message,
              durationMs: record.durationMs || undefined,
              metadata: record.metadata || undefined
            })
            .catch(() => {});
        }
      } catch {}
    }

    // 5. IPC Broadcast to Renderer BrowserWindow
    try {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send('system:log:event', record);
        }
      });
    } catch (err) {
      // IPC window context not yet active
    }
  }

  public getRecentLogs(workspaceId?: string, limit = 100): LogRecord[] {
    let logs = this.memoryLogs;
    if (workspaceId && workspaceId !== 'global') {
      logs = logs.filter((l) => l.workspaceId === workspaceId || l.workspaceId === 'global');
    }
    return logs.slice(-limit).reverse();
  }

  public info(task: string, message: string, workspaceId?: string, metadata?: any): void {
    this.log({ severity: 'info', task, message, workspaceId, metadata });
  }

  public warn(task: string, message: string, workspaceId?: string, metadata?: any): void {
    this.log({ severity: 'warn', task, message, workspaceId, metadata });
  }

  public error(task: string, message: string, workspaceId?: string, err?: any): void {
    const meta =
      err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err;
    this.log({ severity: 'error', task, message, workspaceId, metadata: meta });
  }

  /**
   * Prunes daily JSONL log files older than 10 days.
   */
  private pruneOldLogFiles(): void {
    if (!this.logDir) return;
    try {
      const files = fs.readdirSync(this.logDir);
      const now = Date.now();
      const tenDaysMs = 10 * 24 * 60 * 60 * 1000;

      for (const file of files) {
        if (file.endsWith('.jsonl')) {
          const filePath = join(this.logDir, file);
          const stat = fs.statSync(filePath);
          if (now - stat.mtimeMs > tenDaysMs) {
            fs.unlinkSync(filePath);
            console.log(`[Logger] Pruned old log file: ${file}`);
          }
        }
      }
    } catch (err) {
      console.error('[Logger] Failed to prune logs folder:', err);
    }
  }
}

export const AppLogger = new AppLoggerClass();
(globalThis as any).AppLogger = AppLogger;
