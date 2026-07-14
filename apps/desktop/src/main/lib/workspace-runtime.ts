import Database from 'better-sqlite3';
import { LocalEventBus } from './event-bus';
import { getDatabase, closeDatabase } from '../database/connection';
import { runMigrations } from '../database/runner';
import { JobScheduler } from '../services/scheduler';
import { SyncEngine } from '../services/sync-engine';
import type { SdkClient } from '@leadforge/sdk';

/**
 * WorkspaceRuntime manages a single workspace isolated connection, local event bus,
 * and lifecycle engines (scheduler, sync, etc.).
 */
export class WorkspaceRuntime {
  public readonly workspaceId: string;
  public readonly sqliteDb: Database.Database;
  public readonly eventBus: LocalEventBus;
  private readonly scheduler: JobScheduler;
  private readonly syncEngine: SyncEngine;
  private isRunning: boolean = false;

  constructor(workspaceId: string, sdk: SdkClient) {
    this.workspaceId = workspaceId;
    this.sqliteDb = getDatabase(workspaceId);
    this.eventBus = new LocalEventBus(workspaceId);
    this.scheduler = new JobScheduler(workspaceId, this.sqliteDb, this.eventBus);
    this.syncEngine = new SyncEngine(workspaceId, this.sqliteDb, this.eventBus, sdk);
  }

  /**
   * Initializes workspace-scoped database tables (runs migrations) and starts background engines.
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;

    console.log(`[WorkspaceRuntime] Starting workspace runtime: ${this.workspaceId}`);
    
    // 1. Run migrations on the isolated database
    try {
      runMigrations(this.sqliteDb);
    } catch (err) {
      console.error(`[WorkspaceRuntime] Database migration failed for workspace ${this.workspaceId}:`, err);
      throw err;
    }

    // 2. Start Concurrency Scheduler
    await this.scheduler.start();

    // 3. Start Background Sync Engine
    await this.syncEngine.start();

    this.isRunning = true;
    console.log(`[WorkspaceRuntime] Workspace runtime "${this.workspaceId}" successfully booted.`);
  }

  /**
   * Shuts down background polling, closes database file lock cleanly.
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log(`[WorkspaceRuntime] Stopping workspace runtime: ${this.workspaceId}`);

    // 1. Stop Concurrency Scheduler
    await this.scheduler.stop();

    // 2. Stop Background Sync Engine
    await this.syncEngine.stop();

    // 3. Clear event bus listeners
    this.eventBus.clear();

    // 3. Close SQLite file handle pool connection
    closeDatabase(this.workspaceId);

    this.isRunning = false;
    console.log(`[WorkspaceRuntime] Workspace runtime "${this.workspaceId}" stopped cleanly.`);
  }
}
