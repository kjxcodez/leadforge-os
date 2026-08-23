import { BaseRepository } from '../base/base.repository.js';
import { DiscoveryRunModel, type DiscoveryRunDocument } from '../../db/models/discovery-run.model.js';

export class DiscoveryRunRepository extends BaseRepository<DiscoveryRunDocument> {
  constructor(workspaceId?: string) {
    super(DiscoveryRunModel, workspaceId);
  }
}
