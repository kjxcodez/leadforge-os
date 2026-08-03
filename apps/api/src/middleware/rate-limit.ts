import type { Context, Next } from 'hono';

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
}

/**
 * Lightweight memory-based rate limiter middleware for public REST API endpoints.
 * Sets standard X-RateLimit headers and yields a 429 status code on breach.
 */
export function rateLimiter(config: RateLimitConfig) {
  const hits = new Map<string, { count: number; resetTime: number }>();

  return async (c: Context, next: Next) => {
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    const now = Date.now();
    
    let record = hits.get(ip);
    if (!record || now > record.resetTime) {
      record = {
        count: 0,
        resetTime: now + config.windowMs
      };
    }

    record.count++;
    hits.set(ip, record);

    // Apply standard rate limit compliance headers
    c.header('X-RateLimit-Limit', String(config.max));
    c.header('X-RateLimit-Remaining', String(Math.max(0, config.max - record.count)));
    c.header('X-RateLimit-Reset', String(Math.ceil(record.resetTime / 1000)));

    if (record.count > config.max) {
      return c.json({
        success: false,
        error: config.message || 'Too many requests, please try again later.'
      }, 429);
    }

    return await next();
  };
}
