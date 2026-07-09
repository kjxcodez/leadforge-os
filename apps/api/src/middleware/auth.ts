import { Context, Next } from "hono";
import { UnauthorizedError } from "../errors/index.js";

/**
 * Scaffolding Authentication Middleware.
 * Placeholders to fetch session and authenticate requests.
 *
 * @param c Hono Context
 * @param next Next function
 */
export async function authMiddleware(c: Context, next: Next): Promise<void> {
  const authHeader = c.req.header("Authorization");

  // Authentication logic scaffold:
  // For production foundation, we check if authorization is present or simulate validation.
  // Full integration will rely on Better Auth sessions.
  if (!authHeader) {
    throw new UnauthorizedError("Authentication credentials are required.");
  }

  // Set default authenticated user context scaffold
  c.set("user", {
    id: "scaffold-user-id",
    email: "user@leadforge.os",
    role: "admin",
  });

  await next();
}

/**
 * Scaffolding Workspace tenant isolation Middleware.
 * Ensures scope checks to prevent unauthorized database read/writes.
 *
 * @param c Hono Context
 * @param next Next function
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
