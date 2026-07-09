const fs = require('fs');
const path = require('path');

const authSrcDir = 'c:\\Users\\91637\\Desktop\\Business Project\\leadforge-os\\packages\\auth\\src';

const files = {
  // types
  'types/index.ts': `
import type { User, Session } from '@leadforge/types';

export interface AuthSession extends Session {}
export interface AuthUser extends User {}

export interface AuthState {
  session: AuthSession | null;
  user: AuthUser | null;
}
`,

  // utils
  'utils/password.ts': `
import bcrypt from 'bcryptjs';

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
`,
  'utils/index.ts': `
export * from './password';
`,

  // config
  'config/better-auth.ts': `
import { betterAuth } from 'better-auth';

export interface BetterAuthConfigOptions {
  secret: string;
  baseUrl: string;
  mongodbUri: string;
  authorizeHook?: (credentials: Record<string, unknown>) => Promise<any>;
}

export function createBetterAuth(options: BetterAuthConfigOptions) {
  return betterAuth({
    secret: options.secret,
    baseURL: options.baseUrl,
    database: {
      db: options.mongodbUri,
      provider: 'mongodb',
    },
    providers: [
      {
        id: 'credential',
        name: 'Credentials',
        async authorize(credentials: Record<string, unknown>) {
          if (options.authorizeHook) {
            return options.authorizeHook(credentials);
          }
          return null;
        },
      },
    ],
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
    },
  });
}
`,
  'config/index.ts': `
export * from './better-auth';
`,

  // middleware
  'middleware/hono.ts': `
import { createMiddleware } from 'hono/factory';
import { errorResponse } from '@leadforge/shared';
import { ErrorCode, HttpStatus } from '@leadforge/types';

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
`,
  'middleware/index.ts': `
export * from './hono';
`,

  // root index
  'index.ts': `
export * from './types';
export * from './utils';
export * from './config';
export * from './middleware';
`
};

for (const [relativePath, content] of Object.entries(files)) {
  const fullPath = path.join(authSrcDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content.trim() + '\\n');
}

console.log("Auth package scaffolded.");
