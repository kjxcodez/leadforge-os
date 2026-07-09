import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { successResponse } from "../../utils/index.js";
import { createSuccessResponseSchema, ErrorResponseSchema } from "../../openapi/index.js";

const router = new OpenAPIHono();

const loginInputSchema = z
  .object({
    email: z.string().email().openapi({ example: "admin@leadforge.os" }),
    password: z.string().min(8).openapi({ example: "securePassword123" }),
  })
  .openapi("LoginInput");

const authUserSchema = z
  .object({
    id: z.string().openapi({ example: "user-id-123" }),
    email: z.string().email().openapi({ example: "admin@leadforge.os" }),
    role: z.string().openapi({ example: "admin" }),
  })
  .openapi("AuthUser");

const loginRoute = createRoute({
  method: "post",
  path: "/login",
  summary: "User Authentication Login",
  description: "Authenticates credentials and establishes session cookie.",
  tags: ["Auth"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: loginInputSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createSuccessResponseSchema(authUserSchema, "LoginSuccessResponse"),
        },
      },
      description: "Successfully authenticated session",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Invalid input parameters",
    },
    401: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Unauthorized credentials",
    },
  },
});

router.openapi(loginRoute, (c) => {
  // Authentication route scaffold returning success response.
  return c.json(
    successResponse({
      id: "auth-session-user-id",
      email: "admin@leadforge.os",
      role: "admin",
    }),
    200
  );
});

export { router };
