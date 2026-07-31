import { EventEmitter } from 'events';
/**
 * LocalEventBus is a scoped event emitter for decoupling components and jobs
 * within a single active Workspace Runtime.
 */
export class LocalEventBus {
    workspaceId;
    emitter = new EventEmitter();
    constructor(workspaceId) {
        this.workspaceId = workspaceId;
        this.emitter.setMaxListeners(50);
    }
    /**
     * Publishes an event to all subscribers of the event type and the wildcard '*'.
     */
    publish(type, payload) {
        const event = {
            type,
            workspaceId: this.workspaceId,
            payload,
            timestamp: new Date().toISOString(),
        };
        this.emitter.emit(type, event);
        this.emitter.emit('*', event);
    }
    /**
     * Subscribes a listener to an event type. Returns an unsubscribe function.
     */
    subscribe(type, listener) {
        this.emitter.on(type, listener);
        return () => {
            this.emitter.off(type, listener);
        };
    }
    /**
     * Clears all registered listeners.
     */
    clear() {
        this.emitter.removeAllListeners();
    }
}
//# sourceMappingURL=event-bus.js.map