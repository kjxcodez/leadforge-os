import { WorkspaceRepository } from "../../repositories/workspace/workspace.repository.js";
import type { WorkspaceDocument } from "../../db/models/workspace.model.js";
import { slugify } from "@leadforge/core";

export class WorkspaceService {
  private workspaceRepository: WorkspaceRepository;

  constructor() {
    this.workspaceRepository = new WorkspaceRepository();
  }

  public async getWorkspaceById(id: string): Promise<WorkspaceDocument> {
    return this.workspaceRepository.findById(id);
  }

  public async getWorkspaceBySlug(slug: string): Promise<WorkspaceDocument | null> {
    return this.workspaceRepository.findBySlug(slug);
  }

  public async listUserWorkspaces(userId: string): Promise<WorkspaceDocument[]> {
    return this.workspaceRepository.findUserWorkspaces(userId);
  }

  public async createWorkspace(name: string, ownerId: string): Promise<WorkspaceDocument> {
    const slug = slugify(name);
    return this.workspaceRepository.create({
      name,
      slug,
      ownerId,
      plan: "free",
      members: [
        {
          userId: ownerId,
          role: "admin",
          joinedAt: new Date(),
        },
      ],
    });
  }

  public async addMember(workspaceId: string, userId: string, role: "admin" | "member" | "billing" = "member"): Promise<WorkspaceDocument> {
    const workspace = await this.workspaceRepository.findById(workspaceId);
    
    // Check if member already exists
    const exists = workspace.members.some((m) => m.userId === userId);
    if (exists) {
      return workspace;
    }

    workspace.members.push({
      userId,
      role,
      joinedAt: new Date(),
    });

    return workspace.save();
  }
}
