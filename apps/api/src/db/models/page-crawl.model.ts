import mongoose, { Schema } from 'mongoose';
import {
  workspacePlugin,
  type WorkspaceScopedDocument
} from '../plugins/index.js';

export interface PageCrawlDocument extends mongoose.Document, WorkspaceScopedDocument {
  companyId: string;
  url: string;
  status: number;
  contentHash: string;
  extractedText?: string | null;
  rawHtmlLength: number;
  crawledAt: Date;
}

const pageCrawlSchema = new Schema<PageCrawlDocument>(
  {
    companyId: {
      type: String,
      required: true,
      index: true
    },
    url: { type: String, required: true, trim: true },
    status: { type: Number, required: true, default: 200 },
    contentHash: { type: String, required: true, trim: true },
    // Safeguard: Bounded extracted text representation (max 64KB) to protect free-tier storage
    extractedText: {
      type: String,
      default: null,
      maxlength: 65536
    },
    rawHtmlLength: { type: Number, required: true, default: 0 },
    crawledAt: {
      type: Date,
      required: true,
      default: Date.now
    }
  },
  {
    strict: true,
    timestamps: false
  }
);

// Indexes:
pageCrawlSchema.index({ workspaceId: 1, companyId: 1, url: 1 });
pageCrawlSchema.index({ workspaceId: 1, contentHash: 1 });

pageCrawlSchema.plugin(workspacePlugin);

export const PageCrawlModel = mongoose.models.PageCrawl
  ? (mongoose.models.PageCrawl as mongoose.Model<PageCrawlDocument>)
  : mongoose.model<PageCrawlDocument>('PageCrawl', pageCrawlSchema);
