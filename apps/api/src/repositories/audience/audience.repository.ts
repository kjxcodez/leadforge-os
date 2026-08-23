import { BaseRepository } from '../base/base.repository.js';
import { AudienceModel, type AudienceDocument } from '../../db/models/audience.model.js';

export class AudienceRepository extends BaseRepository<AudienceDocument> {
  constructor(workspaceId?: string) {
    super(AudienceModel, workspaceId);
  }
}
