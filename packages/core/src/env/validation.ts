import { z } from 'zod';
import dotenv from 'dotenv';
import { envSchema } from './env.schema.js';

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
        .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
        .join('\n');
      console.error('❌ Invalid environment variables configuration:\n' + formattedErrors);
    } else {
      console.error('❌ Unknown error validating environment variables:', error);
    }
    
    if (typeof process !== 'undefined' && typeof process.exit === 'function') {
      process.exit(1);
    } else {
      throw error;
    }
  }
}
