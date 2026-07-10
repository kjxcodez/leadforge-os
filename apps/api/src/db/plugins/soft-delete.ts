import type { Schema } from "mongoose";

export interface SoftDeleteDocument {
  deletedAt?: Date | null;
  deletedBy?: string | null;
  restore(): Promise<this>;
  softDelete(deletedBy?: string): Promise<this>;
}

export function softDeletePlugin(schema: Schema) {
  schema.add({
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
    deletedBy: {
      type: String,
      default: null,
    },
  });

  // Query middleware to exclude deleted documents
  const excludeDeleted = function (this: any) {
    const filter = this.getFilter();
    if (filter && filter.includeDeleted === true) {
      delete filter.includeDeleted;
      return;
    }
    this.where({ deletedAt: null });
  };

  schema.pre("find" as any, excludeDeleted);
  schema.pre("findOne" as any, excludeDeleted);
  schema.pre("countDocuments" as any, excludeDeleted);

  schema.methods.softDelete = async function (this: any, deletedBy?: string) {
    this.deletedAt = new Date();
    if (deletedBy) {
      this.deletedBy = deletedBy;
    }
    return this.save();
  };

  schema.methods.restore = async function (this: any) {
    this.deletedAt = null;
    this.deletedBy = null;
    return this.save();
  };
}
