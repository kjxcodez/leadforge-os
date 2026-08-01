import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  MONGODB_URI: z.string().url({ message: 'MONGODB_URI must be a valid MongoDB connection string' }),
  BETTER_AUTH_SECRET: z.string().min(1, { message: 'BETTER_AUTH_SECRET must be provided' }),
  BETTER_AUTH_URL: z.string().url({ message: 'BETTER_AUTH_URL must be a valid URL' }),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  CORS_ORIGIN: z.string().default('*')
});

export type Env = z.infer<typeof envSchema>;
