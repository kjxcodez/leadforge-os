import type { Context, Next } from "hono";
import { createAuthMiddleware } from "@leadforge/auth";
import { auth } from "../config/auth.js";

/**
 * Session-verifying Authentication Middleware from @leadforge/auth.
 * Decodes session cookies and injects current user/session context.
 */
export const authMiddleware = createAuthMiddleware(auth);

import { WorkspaceModel } from "../db/models/workspace.model.js";
import { WorkspaceService } from "../services/workspace/workspace.service.js";
import { ForbiddenError, NotFoundError } from "../errors/index.js";

/**
 * Scaffolding Workspace tenant isolation Middleware.
 * Ensures scope checks to prevent unauthorized database read/writes.
 */
export async function workspaceMiddleware(c: Context, next: Next): Promise<void> {
  const user = c.get("user") as any;
  if (!user) {
    return next();
  }

  const userId = user.id || user._id;
  let workspaceId = c.req.header("x-workspace-id");

  const workspaceService = new WorkspaceService();

  if (workspaceId) {
    try {
      const workspace = await WorkspaceModel.findById(workspaceId);
      if (!workspace) {
        throw new NotFoundError("Workspace not found.");
      }
      const isOwner = workspace.ownerId === userId;
      const isMember = workspace.members.some((m) => m.userId === userId);
      if (!isOwner && !isMember) {
        throw new ForbiddenError("You are not a member of this workspace.");
      }
      c.set("workspaceId", workspaceId);
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof ForbiddenError) {
        throw err;
      }
      throw new ForbiddenError("Invalid workspace context.");
    }
  } else {
    if (user.activeWorkspaceId) {
      workspaceId = user.activeWorkspaceId;
      c.set("workspaceId", workspaceId);
    } else {
      const existingWorkspace = await WorkspaceModel.findOne({
        $or: [{ ownerId: userId }, { "members.userId": userId }],
      });
      if (existingWorkspace) {
        c.set("workspaceId", existingWorkspace._id.toString());
      } else {
        const defaultWorkspace = await workspaceService.createWorkspace({
          name: `${user.name || "Default"}'s Workspace`,
          ownerId: userId,
          ownerEmail: user.email ?? "",
        });
        c.set("workspaceId", defaultWorkspace._id.toString());
      }
    }
  }

  return next();
}
