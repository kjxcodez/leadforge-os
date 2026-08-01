/**
 * Custom application-level base error.
 */
export class ApiError extends Error {
  /**
   * HTTP Status code for the error.
   */
  public readonly statusCode: number;

  /**
   * Custom application internal error code (e.g. 'ERR_VALIDATION').
   */
  public readonly errorCode: string;

  /**
   * Additional details or metadata regarding the error (e.g. validation issues).
   */
  public readonly details: unknown;

  /**
   * Constructs an ApiError instance.
   *
   * @param statusCode HTTP Status Code
   * @param errorCode Application code representing the specific error type
   * @param message Explanatory text message of the error
   * @param details Additional error metadata
   */
  constructor(statusCode: number, errorCode: string, message: string, details: unknown = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation Error indicating invalid payload parameters (HTTP 400).
 */
export class ValidationError extends ApiError {
  constructor(message = 'Validation failed', details: unknown = null) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

/**
 * Unauthorized Error indicating missing or invalid credentials (HTTP 401).
 */
export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized access', details: unknown = null) {
    super(401, 'UNAUTHORIZED', message, details);
  }
}

/**
 * Forbidden Error indicating insufficient user privileges (HTTP 403).
 */
export class ForbiddenError extends ApiError {
  constructor(message = 'Access forbidden', details: unknown = null) {
    super(403, 'FORBIDDEN', message, details);
  }
}

/**
 * NotFound Error indicating target resource was not found (HTTP 404).
 */
export class NotFoundError extends ApiError {
  constructor(message = 'Resource not found', details: unknown = null) {
    super(404, 'NOT_FOUND', message, details);
  }
}

/**
 * Conflict Error indicating database state conflict (HTTP 409).
 */
export class ConflictError extends ApiError {
  constructor(message = 'Resource conflict occurred', details: unknown = null) {
    super(409, 'CONFLICT', message, details);
  }
}

/**
 * Internal Server Error indicating system-level failure (HTTP 500).
 */
export class InternalServerError extends ApiError {
  constructor(message = 'Internal server error', details: unknown = null) {
    super(500, 'INTERNAL_SERVER_ERROR', message, details);
  }
}

/**
 * Database Error indicating Mongo or query failure (HTTP 500).
 */
export class DatabaseError extends ApiError {
  constructor(message = 'Database operation failed', details: unknown = null) {
    super(500, 'DATABASE_ERROR', message, details);
  }
}
