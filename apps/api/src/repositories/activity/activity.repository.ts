import { BaseRepository } from "../base/base.repository.js";
import { ActivityModel, type ActivityDocument } from "../../db/models/activity.model.js";

/**
 * ActivityRepository implements workspace-scoped MongoDB queries for activities.
 */
export class ActivityRepository extends BaseRepository<ActivityDocument> {
  constructor(workspaceId?: string) {
    super(ActivityModel, workspaceId);
  }
}
