import mongoose, { type Schema } from 'mongoose';

export interface WorkspaceScopedDocument {
  workspaceId: string;
}

export function workspacePlugin(schema: Schema) {
  schema.add({
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString()
    },
    workspaceId: {
      type: String,
      required: true,
      index: true
    }
  });
}
