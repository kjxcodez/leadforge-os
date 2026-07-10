import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createWorkspaceDtoSchema, updateWorkspaceDtoSchema } from "@leadforge/schema";
import { WorkspaceService } from "../services/workspace/workspace.service.js";
import { successResponse } from "../utils/index.js";

// Empty placeholder routers for business modules.
export const companiesRouter = new OpenAPIHono();
export const contactsRouter = new OpenAPIHono();
export const campaignsRouter = new OpenAPIHono();
export const outreachRouter = new OpenAPIHono();
export const workspacesRouter = new OpenAPIHono();
export const discoveryRouter = new OpenAPIHono();

const workspaceService = new WorkspaceService();

// Workspace Routes
const listWorkspacesRoute = createRoute({
  method: "get",
  path: "/",
  summary: "List User Workspaces",
  tags: ["Workspace"],
  responses: {
    200: {
      description: "List of workspaces retrieved successfully",
    },
  },
});

workspacesRouter.openapi(listWorkspacesRoute, async (c) => {
  const user = (c as any).get("user");
  const userId = user?.id || user?._id;
  if (!userId) {
    return c.json(successResponse([]));
  }
  const workspaces = await workspaceService.listUserWorkspaces(userId);
  return c.json(successResponse(workspaces));
});

const getWorkspaceRoute = createRoute({
  method: "get",
  path: "/{id}",
  summary: "Get Workspace Details",
  tags: ["Workspace"],
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      description: "Workspace details retrieved",
    },
    404: {
      description: "Workspace not found",
    },
  },
});

workspacesRouter.openapi(getWorkspaceRoute, async (c) => {
  const { id } = c.req.valid("param");
  const workspace = await workspaceService.getWorkspaceById(id);
  return c.json(successResponse(workspace));
});

const createWorkspaceRoute = createRoute({
  method: "post",
  path: "/",
  summary: "Create Workspace",
  tags: ["Workspace"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createWorkspaceDtoSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Workspace created successfully",
    },
  },
});

workspacesRouter.openapi(createWorkspaceRoute, async (c) => {
  const body = c.req.valid("json");
  const user = (c as any).get("user");
  const ownerId = user?.id || user?._id || "system";
  const workspace = await workspaceService.createWorkspace({
    ...body,
    ownerId,
  });
  return c.json(successResponse(workspace));
});

const updateWorkspaceRoute = createRoute({
  method: "patch",
  path: "/{id}",
  summary: "Update Workspace",
  tags: ["Workspace"],
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: {
      content: {
        "application/json": {
          schema: updateWorkspaceDtoSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Workspace updated successfully",
    },
  },
});

workspacesRouter.openapi(updateWorkspaceRoute, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const workspace = await workspaceService.updateWorkspace(id, body);
  return c.json(successResponse(workspace));
});

// Discovery Routes
const discoverySearchRoute = createRoute({
  method: "post",
  path: "/search",
  summary: "Run Discovery Search",
  tags: ["Discovery"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            query: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Discovery search results",
    },
  },
});

discoveryRouter.openapi(discoverySearchRoute, async (c) => {
  const { query } = c.req.valid("json");
  return c.json(
    successResponse({
      companies: [
        { id: "comp_1", name: "Acme Corp", domain: "acme.com", industry: "SaaS" },
      ],
      contacts: [
        { id: "cont_1", firstName: "Alice", email: "alice@acme.com" },
      ],
    })
  );
});

