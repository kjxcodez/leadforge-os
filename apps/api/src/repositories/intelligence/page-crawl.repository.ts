import { BaseRepository } from '../base/base.repository.js';
import { PageCrawlModel, type PageCrawlDocument } from '../../db/models/page-crawl.model.js';

export class PageCrawlRepository extends BaseRepository<PageCrawlDocument> {
  constructor(workspaceId?: string) {
    super(PageCrawlModel, workspaceId);
  }

  public async findByContentHash(companyId: string, contentHash: string): Promise<PageCrawlDocument | null> {
    return this.findOne({ companyId, contentHash });
  }

  public async listByCompany(companyId: string, limit = 50): Promise<PageCrawlDocument[]> {
    return this.findMany({ companyId }, { sort: { crawledAt: -1 }, limit });
  }
}
