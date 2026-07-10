import { Context } from "hono";
import { logger } from "../config/index.js";
import { ApiError } from "../errors/index.js";
import { errorResponse } from "../utils/index.js";

/**
 * Centralized Hono global error handling middleware.
 * Sanitizes system/database exceptions and standardizes error responses.
 *
 * @param error Error instance thrown during route execution
 * @param c Hono Context
 * @returns Response
 */
export function errorHandler(error: Error, c: Context): Response {
  const reqId = c.get("requestId") || "unknown";

  // If error is our standard API Error
  if (error instanceof ApiError) {
    logger.warn(
      { reqId, statusCode: error.statusCode, errorCode: error.errorCode, details: error.details },
      `ApiError handled: ${error.message}`
    );
    return c.json(errorResponse(error.errorCode, error.message, error.details), error.statusCode as any);
  }

  // Handle Mongoose specific validation or query errors safely without exposing DB internals
  if (error.name === "ZodError") {
    logger.warn({ reqId, error }, "Zod validation error handled.");
    const formattedErrors = (error as any).errors?.map((e: any) => ({
      field: e.path.join("."),
      message: e.message,
    })) || null;
    return c.json(
      errorResponse("VALIDATION_ERROR", "Validation constraint violation.", formattedErrors),
      400
    );
  }

  if (error.name === "ValidationError") {
    logger.warn({ reqId, error }, "Mongoose validation error handled.");
    return c.json(
      errorResponse("VALIDATION_ERROR", "Invalid input parameters provided.", null),
      400
    );
  }

  if (error.name === "CastError") {
    logger.warn({ reqId, error }, "Mongoose cast error handled.");
    return c.json(
      errorResponse("BAD_REQUEST", "Resource identifier format is invalid.", null),
      400
    );
  }

  if ((error as any).code === 11000) {
    logger.warn({ reqId, error }, "Mongoose duplicate key error handled.");
    return c.json(
      errorResponse("CONFLICT", "Resource with these parameters already exists.", null),
      409
    );
  }

  // Fallback for internal unhandled exceptions
  logger.error({ reqId, error }, "Unhandled server exception caught in middleware.");

  return c.json(
    errorResponse(
      "INTERNAL_SERVER_ERROR",
      "An unexpected error occurred. Please contact system support.",
      null
    ),
    500
  );
}
