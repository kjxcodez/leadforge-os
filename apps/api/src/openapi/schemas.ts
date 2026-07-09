import { z } from "@hono/zod-openapi";

/**
 * Standard HTTP Error Response schema template for OpenAPI schemas.
 */
export const ErrorResponseSchema = z
  .object({
    success: z.boolean().openapi({ example: false }),
    data: z.null().openapi({ example: null }),
    error: z.object({
      code: z.string().openapi({ example: "BAD_REQUEST" }),
      message: z.string().openapi({ example: "The request could not be understood or was missing parameters." }),
      details: z.any().nullable(),
    }),
  })
  .openapi("ErrorResponse");

/**
 * General Success Response Schema template helper function.
 *
 * @param dataSchema Zod Schema for the inner payload data object
 * @param name Unique registry name for this schema variation
 * @returns Zod OpenAPI Schema representation
 */
export function createSuccessResponseSchema<T extends z.ZodTypeAny>(dataSchema: T, name: string) {
  return z
    .object({
      success: z.boolean().openapi({ example: true }),
      data: dataSchema,
      meta: z.record(z.any()).optional().openapi({ example: { total: 10, page: 1, limit: 10 } }),
      error: z
        .object({
          code: z.string(),
          message: z.string(),
          details: z.any().nullable(),
        })
        .nullable()
        .openapi({ example: null }),
    })
    .openapi(name);
}
