import type { Schema } from 'mongoose';

export interface WorkspaceScopedDocument {
  workspaceId: string;
}

export function workspacePlugin(schema: Schema) {
  schema.add({
    workspaceId: {
      type: String,
      required: true,
      index: true
    }
  });
}
