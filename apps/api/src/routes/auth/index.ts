import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { loginDtoSchema, registerDtoSchema } from '@leadforge/schema';
import { auth } from '../../config/auth.js';
import { ErrorResponseSchema } from '../../openapi/index.js';
import { successResponse } from '../../utils/index.js';
import { ApiError } from '../../errors/index.js';

const router = new OpenAPIHono();

// Helper to forward custom routes to Better Auth handlers
async function handleBetterAuthRequest(c: any, targetPath: string) {
  const url = new URL(c.req.url);
  url.pathname = `/api/v1/auth${targetPath}`;

  const headers = new Headers(c.req.raw.headers);
  const body = c.req.method !== 'GET' && c.req.method !== 'HEAD' ? await c.req.blob() : undefined;

  const modifiedRequest = new Request(url.toString(), {
    method: c.req.method,
    headers,
    body,
    duplex: 'half'
  } as any);

  return auth.handler(modifiedRequest);
}

// 1. POST /login
const loginRoute = createRoute({
  method: 'post',
  path: '/login',
  summary: 'User Login',
  description: 'Authenticates credentials and establishes session cookie.',
  tags: ['Auth'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: loginDtoSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Successfully logged in'
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      },
      description: 'Invalid input parameters'
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      },
      description: 'Unauthorized credentials'
    }
  }
});

router.openapi(loginRoute, async (c) => {
  try {
    const body = await c.req.json();
    const res = await auth.api.signInEmail({
      body: {
        email: body.email,
        password: body.password
      },
      headers: c.req.raw.headers
    });
    return c.json(
      successResponse({
        token: res.token,
        user: res.user
      })
    );
  } catch (err: any) {
    console.error('[DEBUG] Hono Auth sign-in caught error:', err);
    const msg = err.message || 'Invalid credentials.';
    const status = err.status || 401;
    throw new ApiError(status, status === 401 ? 'UNAUTHORIZED' : 'BAD_REQUEST', msg);
  }
});

// 2. POST /signup
const signupRoute = createRoute({
  method: 'post',
  path: '/signup',
  summary: 'User Registration',
  description: 'Registers a new user and establishes a session.',
  tags: ['Auth'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: registerDtoSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Successfully registered and logged in'
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      },
      description: 'Invalid parameters or user already exists'
    }
  }
});

router.openapi(signupRoute, async (c) => {
  try {
    const body = await c.req.json();
    const res = await auth.api.signUpEmail({
      body: {
        email: body.email,
        password: body.password,
        name: body.name
      },
      headers: c.req.raw.headers
    });
    return c.json(
      successResponse({
        token: res.token,
        user: res.user
      })
    );
  } catch (err: any) {
    console.error('[DEBUG] Hono Auth sign-up caught error:', err);
    const msg = err.message || 'Registration failed.';
    const status = err.status || 400;
    throw new ApiError(status, status === 409 ? 'CONFLICT' : 'BAD_REQUEST', msg);
  }
});

// 3. POST /logout
const logoutRoute = createRoute({
  method: 'post',
  path: '/logout',
  summary: 'User Logout',
  description: 'Terminates the active session and clears the session cookie.',
  tags: ['Auth'],
  responses: {
    200: {
      description: 'Successfully logged out'
    }
  }
});

router.openapi(logoutRoute, async (c) => {
  try {
    await auth.api.signOut({
      headers: c.req.raw.headers
    });
    return c.json(successResponse({ success: true }));
  } catch (err: any) {
    console.error('[DEBUG] Hono Auth sign-out caught error:', err);
    return c.json(successResponse({ success: true }));
  }
});

// 4. GET /session
const sessionRoute = createRoute({
  method: 'get',
  path: '/session',
  summary: 'Get Current Session',
  description: 'Retrieves current authenticated session and user details.',
  tags: ['Auth'],
  responses: {
    200: {
      description: 'Active session details retrieved successfully'
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      },
      description: 'Not authenticated'
    }
  }
});

router.openapi(sessionRoute, async (c) => {
  try {
    const res = await auth.api.getSession({
      headers: c.req.raw.headers
    });
    if (!res || !res.session) {
      return c.json(successResponse(null));
    }
    return c.json(
      successResponse({
        token: res.session.token,
        user: res.user
      })
    );
  } catch (err: any) {
    console.error('[DEBUG] Hono Auth session caught error:', err);
    return c.json(successResponse(null));
  }
});

// Wildcard routing to support direct Better Auth client SDK requests
router.on(['GET', 'POST'], '/*', async (c) => {
  return auth.handler(c.req.raw);
});

export { router };
