import type { Context, Next } from "hono";
import { z } from "@hono/zod-openapi";
import { ValidationError } from "../errors/index.js";

type ValidationTarget = "json" | "query" | "param";

/**
 * Reusable input validation middleware using Zod.
 * Validates request payload against the Zod schema and maps errors to a ValidationError.
 *
 * @param target Validation target: 'json' (body), 'query' (URL query), 'param' (URL parameters)
 * @param schema Zod schema definition
 * @returns Hono middleware function
 */
export function validate(target: ValidationTarget, schema: z.ZodSchema) {
  return async (c: Context, next: Next): Promise<void> => {
    let data: unknown;

    try {
      if (target === "json") {
        data = await c.req.json();
      } else if (target === "query") {
        data = c.req.query();
      } else if (target === "param") {
        data = c.req.param();
      }
    } catch (err) {
      throw new ValidationError("Failed to parse request payload.", err);
    }

    const result = schema.safeParse(data);

    if (!result.success) {
      const formattedErrors = result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      throw new ValidationError("Validation constraint violation.", formattedErrors);
    }

    // Set the parsed value back to context for controllers
    c.set(`valid_${target}`, result.data);
    await next();
  };
}
