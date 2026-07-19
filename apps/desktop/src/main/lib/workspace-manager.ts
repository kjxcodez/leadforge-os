import { WorkspaceRuntime } from './workspace-runtime';
import type { SdkClient } from '@leadforge/sdk';

/**
 * WorkspaceManager acts as the Main process runtime supervisor, managing the active
 * workspace instance lifecycle.
 */
class WorkspaceManagerClass {
  private activeRuntime: WorkspaceRuntime | null = null;
  private sdk: SdkClient | null = null;

  public setSdk(sdk: SdkClient): void {
    this.sdk = sdk;
  }

  public getSdk(): SdkClient {
    if (!this.sdk) throw new Error('SDK client has not been set in WorkspaceManager.');
    return this.sdk;
  }

  /**
   * Switches the active workspace, spinning down the previous runtime and booting the new one.
   */
  public async setActiveWorkspace(workspaceId: string | null): Promise<WorkspaceRuntime | null> {
    if (this.activeRuntime && this.activeRuntime.workspaceId === workspaceId) {
      console.log(`[WorkspaceManager] Workspace ${workspaceId} is already active, skipping restart.`);
      return this.activeRuntime;
    }

    // 1. Cleanly spin down current runtime if running
    if (this.activeRuntime) {
      console.log(`[WorkspaceManager] Spinning down active workspace: ${this.activeRuntime.workspaceId}`);
      await this.activeRuntime.stop();
      this.activeRuntime = null;
    }

    if (!workspaceId) {
      console.log('[WorkspaceManager] Active workspace cleared.');
      return null;
    }

    console.log(`[WorkspaceManager] Swapping active workspace runtime to: ${workspaceId}`);
    
    // 2. Initialize new isolated runtime environment
    const runtime = new WorkspaceRuntime(workspaceId, this.getSdk());
    try {
      await runtime.start();
      this.activeRuntime = runtime;
      return runtime;
    } catch (err) {
      console.error(`[WorkspaceManager] Failed to start runtime for workspace ${workspaceId}:`, err);
      // Ensure we don't leave a semi-initialized runtime active
      await runtime.stop();
      throw err;
    }
  }

  /**
   * Retrieves the currently active WorkspaceRuntime.
   */
  public getActiveRuntime(): WorkspaceRuntime | null {
    return this.activeRuntime;
  }
}

export const WorkspaceManager = new WorkspaceManagerClass();
