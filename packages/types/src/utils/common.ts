export type WithId<T> = T & { id: string };
export type WithTimestamps<T> = T & { createdAt: Date; updatedAt: Date };
export type WithWorkspace<T> = T & { workspaceId: string };
export type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T;
export type Nullable<T> = T | null;
export type Brand<K, T> = K & { __brand: T };
