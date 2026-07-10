import { OpenAPIHono } from "@hono/zod-openapi";
import { router as healthRouter } from "./health/index.js";
import { router as authRouter } from "./auth/index.js";
import {
  companiesRouter,
  contactsRouter,
  campaignsRouter,
  outreachRouter,
  workspacesRouter,
  discoveryRouter,
} from "./business.js";

import { authMiddleware, workspaceMiddleware } from "../middleware/auth.js";

const apiRouter = new OpenAPIHono();

// Mount System Health Check
apiRouter.route("/", healthRouter);

// Mount Better Auth credentials endpoints
apiRouter.route("/auth", authRouter);

// Protect business and workspace endpoints
apiRouter.use("/companies/*", authMiddleware, workspaceMiddleware);
apiRouter.use("/contacts/*", authMiddleware, workspaceMiddleware);
apiRouter.use("/campaigns/*", authMiddleware, workspaceMiddleware);
apiRouter.use("/outreach/*", authMiddleware, workspaceMiddleware);
apiRouter.use("/workspaces/*", authMiddleware, workspaceMiddleware);
apiRouter.use("/discovery/*", authMiddleware, workspaceMiddleware);

// Mount empty placeholder business routers
apiRouter.route("/companies", companiesRouter);
apiRouter.route("/contacts", contactsRouter);
apiRouter.route("/campaigns", campaignsRouter);
apiRouter.route("/outreach", outreachRouter);
apiRouter.route("/workspaces", workspacesRouter);
apiRouter.route("/discovery", discoveryRouter);

export { apiRouter };
export { healthRouter, authRouter };
