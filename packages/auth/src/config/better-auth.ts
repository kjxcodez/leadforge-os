import { betterAuth } from 'better-auth';
import { bearer } from 'better-auth/plugins';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { MongoClient } from 'mongodb';

export interface BetterAuthConfigOptions {
  secret: string;
  baseUrl: string;
  mongodbUri: string;
  authorizeHook?: (credentials: Record<string, unknown>) => Promise<any>;
  emailVerification?: {
    sendVerificationEmail: (data: { user: any; url: string; token: string }) => Promise<void>;
  };
  emailAndPassword?: {
    sendResetPassword?: (data: { user: any; url: string; token: string }) => Promise<void>;
  };
  google?: {
    clientId: string;
    clientSecret: string;
  };
}

export function createBetterAuth(options: BetterAuthConfigOptions) {
  const client = new MongoClient(options.mongodbUri);
  const db = client.db();

  const socialProviders: Record<string, any> = {};

  if (options.google) {
    socialProviders.google = {
      clientId: options.google.clientId,
      clientSecret: options.google.clientSecret
    };
  }

  const betterAuthConfig: any = {
    secret: options.secret,
    baseURL: options.baseUrl,
    database: mongodbAdapter(db),
    emailAndPassword: {
      enabled: true
    },
    plugins: [bearer()],
    providers: [
      {
        id: 'credential',
        name: 'Credentials',
        async authorize(credentials: Record<string, unknown>) {
          if (options.authorizeHook) {
            return options.authorizeHook(credentials);
          }
          return null;
        }
      }
    ],
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24 // 1 day
    }
  };

  if (Object.keys(socialProviders).length > 0) {
    betterAuthConfig.socialProviders = socialProviders;
  }

  if (options.emailAndPassword?.sendResetPassword) {
    betterAuthConfig.emailAndPassword.sendResetPassword = options.emailAndPassword.sendResetPassword;
  }

  if (options.emailVerification) {
    betterAuthConfig.emailVerification = {
      autoSignInAfterVerification: true,
      sendOnSignUp: true,
      sendVerificationEmail: options.emailVerification.sendVerificationEmail
    };
  }

  return betterAuth(betterAuthConfig);
}
