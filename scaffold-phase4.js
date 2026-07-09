const fs = require('fs');
const path = require('path');

const configSrcDir = 'c:\\Users\\91637\\Desktop\\Business Project\\leadforge-os\\packages\\config\\src';

const files = {
  // schemas
  'schemas/env.schema.ts': `
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  MONGODB_URI: z.string().url({ message: 'MONGODB_URI must be a valid MongoDB connection string' }),
  BETTER_AUTH_SECRET: z.string().min(1, { message: 'BETTER_AUTH_SECRET must be provided' }),
  BETTER_AUTH_URL: z.string().url({ message: 'BETTER_AUTH_URL must be a valid URL' }),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  CORS_ORIGIN: z.string().default('*'),
});

export type Env = z.infer<typeof envSchema>;
`,
  'schemas/index.ts': `
export * from './env.schema';
`,

  // factories
  'factories/cors.factory.ts': `
export interface CorsConfig {
  origin: string | string[] | ((origin: string) => boolean);
  credentials?: boolean;
  allowMethods?: string[];
  allowHeaders?: string[];
  exposeHeaders?: string[];
  maxAge?: number;
}

export function createCorsConfig(originEnv: string): CorsConfig {
  if (originEnv === '*') {
    return { origin: '*' };
  }
  if (originEnv.includes(',')) {
    const origins = originEnv.split(',').map((o) => o.trim());
    return {
      origin: origins,
      credentials: true,
    };
  }
  return {
    origin: originEnv,
    credentials: true,
  };
}
`,
  'factories/index.ts': `
export * from './cors.factory';
`,

  // utils
  'utils/validation.ts': `
import { z } from 'zod';
import dotenv from 'dotenv';
import { envSchema } from '../schemas/env.schema';

let hasLoaded = false;

export function loadAndValidateEnv() {
  if (!hasLoaded) {
    dotenv.config();
    hasLoaded = true;
  }

  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors
        .map((err) => \`  - \${err.path.join('.')}: \${err.message}\`)
        .join('\\n');
      console.error('❌ Invalid environment variables configuration:\\n' + formattedErrors);
    } else {
      console.error('❌ Unknown error validating environment variables:', error);
    }
    process.exit(1);
  }
}
`,
  'utils/index.ts': `
export * from './validation';
`,

  // root index
  'index.ts': `
export * from './schemas';
export * from './factories';
export * from './utils';
`
};

for (const [relativePath, content] of Object.entries(files)) {
  const fullPath = path.join(configSrcDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content.trim() + '\\n');
}

console.log("Config package scaffolded.");
