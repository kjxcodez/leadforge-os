import { createBetterAuth } from '@leadforge/auth';
import { env } from './env.js';

export const auth = createBetterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseUrl: env.BETTER_AUTH_URL,
  mongodbUri: env.MONGODB_URI,
  authorizeHook: async (credentials) => {
    // Better Auth authorization hook placeholder
    return null;
  }
});
