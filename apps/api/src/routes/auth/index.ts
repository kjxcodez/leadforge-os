import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { loginDtoSchema, registerDtoSchema, forgotPasswordDtoSchema } from '@leadforge/schema';
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

// 5. POST /forgot-password
const forgotPasswordRoute = createRoute({
  method: 'post',
  path: '/forgot-password',
  summary: 'Request Password Reset',
  description: 'Sends a password reset link to the specified email address.',
  tags: ['Auth'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: forgotPasswordDtoSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Reset email sent successfully'
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      },
      description: 'Invalid input parameters or user not found'
    }
  }
});

router.openapi(forgotPasswordRoute, async (c) => {
  try {
    const body = await c.req.json();
    await auth.api.requestPasswordReset({
      body: {
        email: body.email,
        redirectTo: `${process.env.BETTER_AUTH_URL}/api/v1/auth/reset-password-form`
      },
      headers: c.req.raw.headers
    });
    return c.json(successResponse({ success: true }));
  } catch (err: any) {
    console.error('[DEBUG] Hono Auth forgot-password caught error:', err);
    throw new ApiError(err.status || 400, 'BAD_REQUEST', err.message || 'Failed to send reset link.');
  }
});

// 6. POST /resend-verification
const resendVerificationRoute = createRoute({
  method: 'post',
  path: '/resend-verification',
  summary: 'Resend Verification Email',
  description: 'Resends the email verification link to the specified email.',
  tags: ['Auth'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: forgotPasswordDtoSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Verification email sent successfully'
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      },
      description: 'Invalid parameters or verification not enabled'
    }
  }
});

router.openapi(resendVerificationRoute, async (c) => {
  try {
    const body = await c.req.json();
    await auth.api.sendVerificationEmail({
      body: {
        email: body.email
      },
      headers: c.req.raw.headers
    });
    return c.json(successResponse({ success: true }));
  } catch (err: any) {
    console.error('[DEBUG] Hono Auth resend-verification caught error:', err);
    throw new ApiError(err.status || 400, 'BAD_REQUEST', err.message || 'Failed to send verification link.');
  }
});

// GET /reset-password-form - serves the reset password HTML form
router.get('/reset-password-form', (c) => {
  const token = c.req.query('token') || '';
  if (!token) {
    return c.html(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Error - LeadForge OS</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Outfit', sans-serif; background-color: #0c0a09; color: #e7e5e4; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
          .card { background-color: #1c1917; border: 1px solid #2e2a24; padding: 40px; text-align: center; }
          h2 { color: #ef4444; margin-top: 0; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Invalid Link</h2>
          <p>This password reset link is invalid or expired.</p>
        </div>
      </body>
      </html>
    `, 400);
  }

  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reset Password - LeadForge OS</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Outfit', sans-serif; background-color: #0c0a09; color: #e7e5e4; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; box-sizing: border-box; margin: 0; }
        .card { width: 100%; max-width: 400px; background-color: #1c1917; border: 1px solid #2e2a24; padding: 40px; box-sizing: border-box; }
        .logo { font-size: 24px; font-weight: 800; color: #ffffff; margin-bottom: 32px; letter-spacing: -0.03em; text-align: center; }
        h2 { font-size: 18px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 8px; }
        p.desc { font-size: 12px; color: #a8a29e; margin-top: 0; margin-bottom: 24px; line-height: 1.6; }
        .form-group { margin-bottom: 20px; }
        label { display: block; font-size: 11px; text-transform: uppercase; font-weight: 600; color: #78716c; margin-bottom: 6px; letter-spacing: 0.05em; }
        input { width: 100%; background-color: #0c0a09; border: 1px solid #2e2a24; color: #ffffff; padding: 10px 14px; font-size: 13px; font-family: inherit; box-sizing: border-box; outline: none; transition: border-color 0.15s ease; }
        input:focus { border-color: #f5f5f4; }
        button { width: 100%; background-color: #f5f5f4; color: #0c0a09; border: none; padding: 12px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background-color 0.15s ease; }
        button:hover { background-color: #e7e5e4; }
        .error-msg { font-size: 11px; color: #ef4444; margin-top: 12px; display: none; text-align: center; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">LEADFORGE OS</div>
        <h2>Reset Password</h2>
        <p class="desc">Please enter your new password below. It must be at least 6 characters long.</p>
        <form action="/api/v1/auth/reset-password-submit" method="POST" onsubmit="return validateForm()">
          <input type="hidden" name="token" value="${token}" />
          <div class="form-group">
            <label for="newPassword">New Password</label>
            <input type="password" id="newPassword" name="newPassword" required minlength="6" autofocus />
          </div>
          <div class="form-group">
            <label for="confirmPassword">Confirm Password</label>
            <input type="password" id="confirmPassword" required minlength="6" />
          </div>
          <button type="submit">Update Password</button>
          <div id="error" class="error-msg">Passwords do not match.</div>
        </form>
      </div>
      <script>
        function validateForm() {
          var pass = document.getElementById('newPassword').value;
          var conf = document.getElementById('confirmPassword').value;
          var err = document.getElementById('error');
          if (pass !== conf) {
            err.style.display = 'block';
            return false;
          }
          err.style.display = 'none';
          return true;
        }
      </script>
    </body>
    </html>
  `);
});

// POST /reset-password-submit - handles password reset form submission
router.post('/reset-password-submit', async (c) => {
  try {
    const body = await c.req.parseBody();
    const token = body.token as string;
    const newPassword = body.newPassword as string;

    if (!token || !newPassword) {
      throw new Error('Token and password are required.');
    }

    await auth.api.resetPassword({
      body: {
        token,
        newPassword
      },
      headers: c.req.raw.headers
    });

    return c.html(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Success - LeadForge OS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Outfit', sans-serif; background-color: #0c0a09; color: #e7e5e4; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; box-sizing: border-box; }
          .card { width: 100%; max-width: 400px; background-color: #1c1917; border: 1px solid #2e2a24; padding: 40px; box-sizing: border-box; text-align: center; }
          .logo { font-size: 24px; font-weight: 800; color: #ffffff; margin-bottom: 32px; letter-spacing: -0.03em; }
          .icon-box { width: 48px; height: 48px; background-color: #14532d; border: 1px solid #166534; color: #4ade80; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px auto; font-size: 24px; font-weight: bold; }
          h2 { font-size: 18px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 12px; }
          p { font-size: 13px; color: #a8a29e; line-height: 1.6; margin-top: 0; margin-bottom: 24px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="logo">LEADFORGE OS</div>
          <div class="icon-box">✓</div>
          <h2>Password Updated</h2>
          <p>Your password has been reset successfully.</p>
          <div style="font-size: 11px; color: #78716c;">You can now close this window and log in on the desktop app.</div>
        </div>
      </body>
      </html>
    `);
  } catch (err: any) {
    console.error('[DEBUG] Hono Auth reset-password-submit caught error:', err);
    return c.html(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Error - LeadForge OS</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Outfit', sans-serif; background-color: #0c0a09; color: #e7e5e4; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
          .card { background-color: #1c1917; border: 1px solid #2e2a24; padding: 40px; text-align: center; }
          h2 { color: #ef4444; margin-top: 0; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Reset Failed</h2>
          <p>${err.message || 'An error occurred during password reset.'}</p>
        </div>
      </body>
      </html>
    `, 400);
  }
});

// GET /verify-success - serves verification success page
router.get('/verify-success', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Email Verified - LeadForge OS</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Outfit', sans-serif; background-color: #0c0a09; color: #e7e5e4; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; box-sizing: border-box; }
        .card { width: 100%; max-width: 400px; background-color: #1c1917; border: 1px solid #2e2a24; padding: 40px; box-sizing: border-box; text-align: center; }
        .logo { font-size: 24px; font-weight: 800; color: #ffffff; margin-bottom: 32px; letter-spacing: -0.03em; }
        .icon-box { width: 48px; height: 48px; background-color: #14532d; border: 1px solid #166534; color: #4ade80; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px auto; font-size: 24px; font-weight: bold; }
        h2 { font-size: 18px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 12px; }
        p { font-size: 13px; color: #a8a29e; line-height: 1.6; margin-top: 0; margin-bottom: 24px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">LEADFORGE OS</div>
        <div class="icon-box">✓</div>
        <h2>Email Verified</h2>
        <p>Your email address has been verified successfully.</p>
        <div style="font-size: 11px; color: #78716c;">You can now close this window and log in on the desktop app.</div>
      </div>
    </body>
    </html>
  `);
});

// Wildcard routing to support direct Better Auth client SDK requests
router.on(['GET', 'POST'], '/*', async (c) => {
  return auth.handler(c.req.raw);
});

export { router };
