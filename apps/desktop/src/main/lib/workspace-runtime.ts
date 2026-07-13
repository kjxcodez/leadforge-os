import Database from 'better-sqlite3';
import { LocalEventBus } from './event-bus';
import { getDatabase, closeDatabase } from '../database/connection';
import { runMigrations } from '../database/runner';

/**
 * WorkspaceRuntime manages a single workspace isolated connection, local event bus,
 * and lifecycle engines (scheduler, sync, etc.).
 */
export class WorkspaceRuntime {
  public readonly workspaceId: string;
  public readonly sqliteDb: Database.Database;
  public readonly eventBus: LocalEventBus;
  private isRunning: boolean = false;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
    this.sqliteDb = getDatabase(workspaceId);
    this.eventBus = new LocalEventBus(workspaceId);
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

    // 2. Future hooks for JobScheduler and SyncEngine start will be registered here

    this.isRunning = true;
    console.log(`[WorkspaceRuntime] Workspace runtime "${this.workspaceId}" successfully booted.`);
  }

  /**
   * Shuts down background polling, closes database file lock cleanly.
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log(`[WorkspaceRuntime] Stopping workspace runtime: ${this.workspaceId}`);

    // 1. Future hooks for JobScheduler and SyncEngine stop go here

    // 2. Clear event bus listeners
    this.eventBus.clear();

    // 3. Close SQLite file handle pool connection
    closeDatabase(this.workspaceId);

    this.isRunning = false;
    console.log(`[WorkspaceRuntime] Workspace runtime "${this.workspaceId}" stopped cleanly.`);
  }
}
