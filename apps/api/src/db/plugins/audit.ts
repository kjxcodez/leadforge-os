import type { Schema } from "mongoose";

export interface AuditDocument {
  createdBy?: string | null;
  updatedBy?: string | null;
}

export function auditPlugin(schema: Schema) {
  schema.add({
    createdBy: {
      type: String,
      default: null,
    },
    updatedBy: {
      type: String,
      default: null,
    },
  });
}
