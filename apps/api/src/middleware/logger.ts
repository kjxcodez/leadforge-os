import type { Context, Next } from 'hono';
import { logger } from '../config/index.js';

/**
 * Middleware that appends a unique X-Request-ID header to every request and response.
 *
 * @param c Hono Context
 * @param next Next function
 */
export async function requestIdMiddleware(c: Context, next: Next): Promise<void> {
  const reqId = crypto.randomUUID();
  c.set('requestId', reqId);
  c.header('x-request-id', reqId);
  await next();
}

export function sanitizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    let changed = false;
    ['code', 'state', 'token', 'access_token', 'refresh_token', 'code_verifier'].forEach((key) => {
      if (parsed.searchParams.has(key)) {
        parsed.searchParams.set(key, '[REDACTED]');
        changed = true;
      }
    });
    if (changed) return parsed.toString();
  } catch {
    // Regex fallback if URL parsing fails
  }
  return rawUrl
    .replace(/code=[^&]+/gi, 'code=[REDACTED]')
    .replace(/state=[^&]+/gi, 'state=[REDACTED]')
    .replace(/token=[^&]+/gi, 'token=[REDACTED]')
    .replace(/access_token=[^&]+/gi, 'access_token=[REDACTED]')
    .replace(/refresh_token=[^&]+/gi, 'refresh_token=[REDACTED]');
}

/**
 * Middleware that logs HTTP incoming request details and execution duration.
 *
 * @param c Hono Context
 * @param next Next function
 */
export async function loggerMiddleware(c: Context, next: Next): Promise<void> {
  const reqId = c.get('requestId') || crypto.randomUUID();
  const method = c.req.method;
  const url = sanitizeUrl(c.req.url);
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
