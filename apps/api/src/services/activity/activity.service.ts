import { ActivityRepository } from "../../repositories/activity/activity.repository.js";
import type { ActivityDocument } from "../../db/models/activity.model.js";

/**
 * ActivityService logs history activities inside a workspace tenant.
 */
export class ActivityService {
  private activityRepository: ActivityRepository;

  constructor(workspaceId: string) {
    this.activityRepository = new ActivityRepository(workspaceId);
  }

  /**
   * Appends an audit log activity entry.
   */
  public async logActivity(type: string, content: string): Promise<ActivityDocument> {
    return this.activityRepository.create({ type, content });
  }

  /**
   * Lists all logged workspace activities (sorted by createdAt DESC).
   */
  public async listActivities(page?: number, limit?: number): Promise<{ data: ActivityDocument[]; total: number }> {
    return this.activityRepository.paginate({}, page, limit);
  }
}
