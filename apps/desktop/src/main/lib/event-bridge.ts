import { BrowserWindow } from 'electron';
import { LocalEventBus, type AppEvent } from './event-bus';

/**
 * EventBridge routes events from the main process's workspace LocalEventBus
 * to the renderer process via Electron IPC.
 *
 * Spec: worker_runtime_spec.md / TASK-012
 */
export class EventBridge {
  private unsubscribes: Array<() => void> = [];

  constructor(private eventBus: LocalEventBus) {}

  /**
   * Starts listening to events on the LocalEventBus and forwarding them to the renderer.
   */
  public start(): void {
    // 1. Forward job:progress
    this.unsubscribes.push(
      this.eventBus.subscribe('job:progress', (event: AppEvent) => {
        this.broadcast('job:progress', {
          jobId: event.payload.jobId,
          progress: event.payload.progress,
          metadata: event.payload.metadata,
        });
      })
    );

    // 2. Forward job:completed
    this.unsubscribes.push(
      this.eventBus.subscribe('job:completed', (event: AppEvent) => {
        this.broadcast('job:completed', {
          jobId: event.payload.jobId,
          result: event.payload.result,
        });
      })
    );

    // 3. Forward job:failed
    this.unsubscribes.push(
      this.eventBus.subscribe('job:failed', (event: AppEvent) => {
        this.broadcast('job:failed', {
          jobId: event.payload.jobId,
          error: event.payload.error,
          willRetry: event.payload.willRetry,
        });
      })
    );
  }

  /**
   * Stops listening and cleans up subscriptions to prevent memory leaks.
   */
  public stop(): void {
    this.unsubscribes.forEach((unsub) => unsub());
    this.unsubscribes = [];
  }

  /**
   * Broadcasts an event to all open renderer windows.
   */
  private broadcast(channel: string, payload: any): void {
    try {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send(channel, payload);
        }
      });
    } catch (err) {
      // IPC window context not yet active
    }
  }
}
