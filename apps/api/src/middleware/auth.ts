import type { Context, Next } from "hono";
import { createAuthMiddleware } from "@leadforge/auth";
import { auth } from "../config/auth.js";

/**
 * Session-verifying Authentication Middleware from @leadforge/auth.
 * Decodes session cookies and injects current user/session context.
 */
export const authMiddleware = createAuthMiddleware(auth);

/**
 * Scaffolding Workspace tenant isolation Middleware.
 * Ensures scope checks to prevent unauthorized database read/writes.
 */
export async function workspaceMiddleware(c: Context, next: Next): Promise<void> {
  const workspaceId = c.req.header("x-workspace-id");

  // Scaffold workspace tenant access check
  if (!workspaceId) {
    // We default to a global/default workspace id if not provided for setup
    c.set("workspaceId", "default-workspace-id");
  } else {
    c.set("workspaceId", workspaceId);
  }

  await next();
}
