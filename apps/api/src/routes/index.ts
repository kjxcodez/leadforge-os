import { OpenAPIHono } from "@hono/zod-openapi";
import { router as healthRouter } from "./health/index.js";
import { router as authRouter } from "./auth/index.js";
import {
  companiesRouter,
  contactsRouter,
  campaignsRouter,
  outreachRouter,
} from "./business.js";

const apiRouter = new OpenAPIHono();

// Mount System Health Check
apiRouter.route("/", healthRouter);

// Mount Better Auth credentials endpoints
apiRouter.route("/auth", authRouter);

// Mount empty placeholder business routers
apiRouter.route("/companies", companiesRouter);
apiRouter.route("/contacts", contactsRouter);
apiRouter.route("/campaigns", campaignsRouter);
apiRouter.route("/outreach", outreachRouter);

export { apiRouter };
export { healthRouter, authRouter };
