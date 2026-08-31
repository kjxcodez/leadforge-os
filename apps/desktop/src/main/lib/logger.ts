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

    // 1. Standard Streams
    const consoleMsg = `[${timestamp}] [${record.severity.toUpperCase()}] [${record.task}] ${record.message}`;
    if (record.severity === 'error') {
      console.error(consoleMsg);
    } else if (record.severity === 'warn') {
      console.warn(consoleMsg);
    } else {
      console.log(consoleMsg);
    }

    // 2. SQLite system_logs database write (if legacy table exists in local database)
    if (params.workspaceId) {
      try {
        const db = getDatabase(params.workspaceId);
        const hasTable = db
          .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='system_logs'`)
          .get();
        if (hasTable) {
          db.prepare(
            `
            INSERT INTO system_logs (id, workspaceId, workerId, severity, task, message, durationMs, metadata, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
          ).run(
            record.id,
            record.workspaceId,
            record.workerId,
            record.severity,
            record.task,
            record.message,
            record.durationMs,
            record.metadata ? JSON.stringify(record.metadata) : null,
            record.timestamp
          );

          // Cap to latest 5000 lines
          db.prepare(
            `
            DELETE FROM system_logs WHERE id NOT IN (
              SELECT id FROM system_logs ORDER BY timestamp DESC LIMIT 5000
            )
          `
          ).run();
        }
      } catch (err) {
        // SQLite logging is best-effort
      }
    }

    // 3. Rotating file system JSONL write
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

    // 4. IPC Broadcast to Renderer BrowserWindow
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
