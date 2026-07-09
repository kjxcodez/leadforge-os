import { Context, Next } from "hono";
import { logger } from "../config/index.js";

/**
 * Middleware that appends a unique X-Request-ID header to every request and response.
 *
 * @param c Hono Context
 * @param next Next function
 */
export async function requestIdMiddleware(c: Context, next: Next): Promise<void> {
  const reqId = crypto.randomUUID();
  c.set("requestId", reqId);
  c.header("x-request-id", reqId);
  await next();
}

/**
 * Middleware that logs HTTP incoming request details and execution duration.
 *
 * @param c Hono Context
 * @param next Next function
 */
export async function loggerMiddleware(c: Context, next: Next): Promise<void> {
  const reqId = c.get("requestId") || crypto.randomUUID();
  const { method, url } = c.req;
  const start = Date.now();

  logger.info({ reqId, method, url }, `📥 Incoming Request: ${method} ${url}`);

  try {
    await next();
    const duration = Date.now() - start;
    const status = c.res.status;
    logger.info(
      { reqId, method, url, status, duration: `${duration}ms` },
      `📤 Request Processed: ${method} ${url} - ${status} (${duration}ms)`
    );
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(
      { reqId, method, url, error, duration: `${duration}ms` },
      `❌ Request Failed: ${method} ${url} (${duration}ms)`
    );
    throw error;
  }
}
