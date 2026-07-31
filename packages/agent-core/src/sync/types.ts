export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';

export interface SyncQueueItem {
  readonly id: string;
  readonly workspaceId: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly operation: SyncOperation;
  readonly payload: string | null;
  readonly retryCount: number;
  readonly error?: string;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SyncMetadata {
  readonly workspaceId: string;
  readonly entityType: string;
  readonly lastSyncedAt: string;
  readonly versionStamp: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}
