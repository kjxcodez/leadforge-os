import { WorkspaceRepository } from "../../repositories/workspace/workspace.repository.js";
import type { WorkspaceDocument } from "../../db/models/workspace.model.js";
import { slugify } from "@leadforge/core";
import { createWorkspaceDtoSchema, updateWorkspaceDtoSchema, type CreateWorkspaceDto, type UpdateWorkspaceDto } from "@leadforge/schema";

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

  public async createWorkspace(dto: CreateWorkspaceDto & { ownerId: string }): Promise<WorkspaceDocument> {
    const validated = createWorkspaceDtoSchema.parse(dto);
    const slug = slugify(validated.name);
    return this.workspaceRepository.create({
      name: validated.name,
      slug,
      ownerId: dto.ownerId,
      plan: "free",
      settings: validated.settings || { defaultTimezone: "UTC" },
      members: [
        {
          userId: dto.ownerId,
          role: "admin",
          joinedAt: new Date(),
        },
      ],
    });
  }

  public async updateWorkspace(id: string, dto: UpdateWorkspaceDto): Promise<WorkspaceDocument> {
    const validated = updateWorkspaceDtoSchema.parse(dto);
    return this.workspaceRepository.update(id, validated);
  }

  public async addMember(workspaceId: string, userId: string, role: "admin" | "member" | "billing" = "member"): Promise<WorkspaceDocument> {
    const workspace = await this.workspaceRepository.findById(workspaceId);
    
    // Check if member already exists
    const exists = workspace.members.some((m) => m.userId === userId);
    if (exists) {
      return workspace;
    }

    const updatedMembers = [
      ...workspace.members,
      {
        userId,
        role,
        joinedAt: new Date(),
      },
    ];

    return this.workspaceRepository.update(workspaceId, {
      members: updatedMembers,
    });
  }
}
