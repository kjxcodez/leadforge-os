import { BaseRepository } from "../base/base.repository.js";
import { WorkspaceModel, type WorkspaceDocument } from "../../db/models/workspace.model.js";

export class WorkspaceRepository extends BaseRepository<WorkspaceDocument> {
  constructor() {
    super(WorkspaceModel);
  }

  public async findBySlug(slug: string): Promise<WorkspaceDocument | null> {
    return this.findOne({ slug });
  }

  public async findUserWorkspaces(userId: string): Promise<WorkspaceDocument[]> {
    return this.findMany({ "members.userId": userId });
  }
}
