import { BaseRepository } from '../base/base.repository.js';
import {
  CompanyDiscoveryRunModel,
  type CompanyDiscoveryRunDocument
} from '../../db/models/company-discovery-run.model.js';

export class CompanyDiscoveryRunRepository extends BaseRepository<CompanyDiscoveryRunDocument> {
  constructor(workspaceId?: string) {
    super(CompanyDiscoveryRunModel, workspaceId);
  }
}
