import type { Schema } from "mongoose";

export interface TimestampDocument {
  createdAt: Date;
  updatedAt: Date;
}

export function timestampPlugin(schema: Schema) {
  schema.set("timestamps", true);
}
