import { z } from "@hono/zod-openapi";

/**
 * Standard HTTP Error Response schema template for OpenAPI schemas.
 */
export const ErrorResponseSchema = z
  .object({
    success: z.boolean(),
    data: z.null(),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.any().nullable(),
    }),
  })
  .openapi("ErrorResponse", {
    example: {
      success: false,
      data: null,
      error: {
        code: "BAD_REQUEST",
        message: "The request could not be understood or was missing parameters.",
        details: null,
      },
    },
  });

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
      success: z.boolean(),
      data: dataSchema,
      meta: z.record(z.any()).optional(),
      error: z
        .object({
          code: z.string(),
          message: z.string(),
          details: z.any().nullable(),
        })
        .nullable(),
    })
    .openapi(name);
}
