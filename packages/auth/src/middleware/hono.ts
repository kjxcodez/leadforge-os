import { createMiddleware } from 'hono/factory';
import { errorResponse } from '@leadforge/shared';
import { ErrorCode, HttpStatus } from '@leadforge/schema';

export function createAuthMiddleware(authInstance: any) {
  return createMiddleware(async (c, next) => {
    const session = await authInstance.api.getSession({
      headers: c.req.raw.headers,
    });
    if (!session) {
      return c.json(
        errorResponse('Unauthorized access. Please log in.', ErrorCode.UNAUTHORIZED),
        HttpStatus.UNAUTHORIZED
      );
    }
    c.set('session', session.session);
    c.set('user', session.user);
    await next();
  });
}
