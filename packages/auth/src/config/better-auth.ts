import { betterAuth } from 'better-auth';
import { bearer } from 'better-auth/plugins';

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
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
      bearer(),
    ],
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
