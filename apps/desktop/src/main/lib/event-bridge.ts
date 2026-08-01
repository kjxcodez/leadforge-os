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
          metadata: event.payload.metadata
        });
      })
    );

    // 2. Forward job:completed
    this.unsubscribes.push(
      this.eventBus.subscribe('job:completed', (event: AppEvent) => {
        this.broadcast('job:completed', {
          jobId: event.payload.jobId,
          result: event.payload.result
        });
      })
    );

    // 3. Forward job:failed
    this.unsubscribes.push(
      this.eventBus.subscribe('job:failed', (event: AppEvent) => {
        this.broadcast('job:failed', {
          jobId: event.payload.jobId,
          error: event.payload.error,
          willRetry: event.payload.willRetry
        });
      })
    );

    // 4. Forward job:starting
    this.unsubscribes.push(
      this.eventBus.subscribe('job:starting', (event: AppEvent) => {
        this.broadcast('job:starting', {
          jobId: event.payload.jobId,
          workerId: event.payload.workerId
        });
      })
    );

    // 5. Forward job:started
    this.unsubscribes.push(
      this.eventBus.subscribe('job:started', (event: AppEvent) => {
        this.broadcast('job:started', {
          jobId: event.payload.jobId,
          workerId: event.payload.workerId
        });
      })
    );

    // 6. Forward job:paused
    this.unsubscribes.push(
      this.eventBus.subscribe('job:paused', (event: AppEvent) => {
        this.broadcast('job:paused', {
          jobId: event.payload.jobId
        });
      })
    );

    // 7. Forward job:cancelled
    this.unsubscribes.push(
      this.eventBus.subscribe('job:cancelled', (event: AppEvent) => {
        this.broadcast('job:cancelled', {
          jobId: event.payload.jobId
        });
      })
    );

    // 8. Forward automation events
    const autoEvents: Array<
      | 'automation:queued'
      | 'automation:started'
      | 'automation:resumed'
      | 'automation:paused'
      | 'automation:waiting'
      | 'automation:completed'
      | 'automation:cancelled'
      | 'automation:failed'
      | 'automation:recovered'
    > = [
      'automation:queued',
      'automation:started',
      'automation:resumed',
      'automation:paused',
      'automation:waiting',
      'automation:completed',
      'automation:cancelled',
      'automation:failed',
      'automation:recovered'
    ];

    autoEvents.forEach((ch) => {
      this.unsubscribes.push(
        this.eventBus.subscribe(ch, (event: AppEvent) => {
          this.broadcast(ch, event.payload);
        })
      );
    });
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
