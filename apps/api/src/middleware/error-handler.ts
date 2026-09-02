import { Context } from 'hono';
import { logger } from '../config/index.js';
import { ApiError } from '../errors/index.js';
import { errorResponse } from '../utils/index.js';

/**
 * Centralized Hono global error handling middleware.
 * Sanitizes system/database exceptions and standardizes error responses.
 *
 * @param error Error instance thrown during route execution
 * @param c Hono Context
 * @returns Response
 */
export function errorHandler(error: Error, c: Context): Response {
  const reqId = c.get('requestId') || 'unknown';

  // Handle ApiError application exceptions cleanly
  if (error instanceof ApiError) {
    const statusCode = error.statusCode || 500;
    const errorCode = error.errorCode || 'INTERNAL_SERVER_ERROR';
    if (statusCode >= 500) {
      logger.error({ reqId, statusCode, errorCode, message: error.message, stack: error.stack }, `ApiError: ${error.message}`);
    } else {
      logger.warn({ reqId, statusCode, errorCode, message: error.message }, `ApiError handled: ${error.message}`);
    }
    return c.json(errorResponse(errorCode, error.message, error.details || null), statusCode as any);
  }

  // Handle Domain exceptions (EmailDomainError, DriveDomainError, AttachmentDomainError) cleanly
  if (
    error.name === 'EmailDomainError' ||
    error.name === 'DriveDomainError' ||
    error.name === 'AttachmentDomainError' ||
    (error as any).code === 'TRANSACTION_NOT_FOUND' ||
    (error as any).code?.startsWith?.('ATTACHMENT') ||
    (error as any).code?.startsWith?.('TEST_RECIPIENT') ||
    (error as any).code?.startsWith?.('MAILBOX') ||
    (error as any).code?.startsWith?.('EMAIL') ||
    (error as any).code?.startsWith?.('GMAIL') ||
    (error as any).code?.startsWith?.('DRIVE')
  ) {
    const domainErr = error as any;
    const code = domainErr.code || 'BAD_REQUEST';
    let statusCode = domainErr.statusCode || 400;

    if (!domainErr.statusCode) {
      if (
        code === 'MAILBOX_NOT_FOUND' ||
        code === 'ATTACHMENT_NOT_FOUND' ||
        code === 'TRANSACTION_NOT_FOUND' ||
        code === 'DRIVE_FILE_NOT_FOUND' ||
        code === 'DRIVE_CONNECTION_NOT_FOUND'
      ) {
        statusCode = 404;
      } else if (
        code === 'EMAIL_RATE_LIMITED' ||
        code === 'TEST_RECIPIENT_LIMIT_REACHED' ||
        code === 'SENDER_RATE_LIMITED' ||
        code === 'DRIVE_RATE_LIMITED'
      ) {
        statusCode = 429;
      } else if (
        code === 'MAILBOX_REAUTH_REQUIRED' ||
        code === 'MAILBOX_NOT_AUTHORIZED' ||
        code === 'GMAIL_AUTH_REVOKED' ||
        code === 'DRIVE_AUTH_REQUIRED' ||
        code === 'DRIVE_REAUTH_REQUIRED'
      ) {
        statusCode = 401;
      } else if (
        code === 'MAILBOX_DISCONNECTED' ||
        code === 'ATTACHMENT_ACCESS_DENIED' ||
        code === 'DRIVE_ATTACHMENT_ACCESS_DENIED' ||
        code === 'DRIVE_ACCESS_DENIED'
      ) {
        statusCode = 403;
      } else if (code === 'ATTACHMENT_SIZE_EXCEEDED') {
        statusCode = 413;
      } else if (
        code === 'DRIVE_UPLOAD_FAILED' ||
        code === 'DRIVE_DOWNLOAD_FAILED' ||
        code === 'ATTACHMENT_BINARY_EMPTY'
      ) {
        statusCode = 502;
      }
    }

    const wsId = c.get('workspaceId') || 'unknown';
    logger.warn(
      {
        correlationId: reqId,
        workspaceId: wsId,
        operation: c.req.path,
        method: c.req.method,
        errorCode: code,
        statusCode,
        message: domainErr.message
      },
      `Domain error handled [${code}]: ${domainErr.message}`
    );
    return c.json(errorResponse(code, domainErr.message, null), statusCode as any);
  }

  // Handle Mongoose specific validation or query errors safely without exposing DB internals
  if (error.name === 'ZodError') {
    logger.warn({ reqId, error }, 'Zod validation error handled.');
    const formattedErrors =
      (error as any).errors?.map((e: any) => ({
        field: e.path.join('.'),
        message: e.message
      })) || null;
    return c.json(
      errorResponse('VALIDATION_ERROR', 'Validation constraint violation.', formattedErrors),
      400
    );
  }

  if (error.name === 'ValidationError') {
    logger.warn({ reqId, error }, 'Mongoose validation error handled.');
    return c.json(
      errorResponse('VALIDATION_ERROR', 'Invalid input parameters provided.', null),
      400
    );
  }

  if (error.name === 'CastError') {
    logger.warn({ reqId, error }, 'Mongoose cast error handled.');
    return c.json(
      errorResponse('BAD_REQUEST', 'Resource identifier format is invalid.', null),
      400
    );
  }

  if ((error as any).code === 11000) {
    logger.warn({ reqId, error }, 'Mongoose duplicate key error handled.');
    return c.json(
      errorResponse('CONFLICT', 'Resource with these parameters already exists.', null),
      409
    );
  }

  // Fallback for internal unhandled exceptions
  logger.error(
    {
      reqId,
      errName: error.name,
      errMsg: error.message,
      errStack: error.stack
    },
    'Unhandled server exception caught in middleware.'
  );

  return c.json(
    errorResponse(
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred. Please contact system support.',
      null
    ),
    500
  );
}
