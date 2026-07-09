import { z } from "zod";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

/**
 * Zod schema for environment variable validation.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  MONGODB_URI: z.string().url({ message: "MONGODB_URI must be a valid MongoDB connection string" }),
  BETTER_AUTH_SECRET: z.string().min(1, { message: "BETTER_AUTH_SECRET must be provided" }),
  BETTER_AUTH_URL: z.string().url({ message: "BETTER_AUTH_URL must be a valid URL" }),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  CORS_ORIGIN: z.string().default("*"),
});

/**
 * Validated environment object.
 */
let env: z.infer<typeof envSchema>;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    const formattedErrors = error.errors
      .map((err) => `  - ${err.path.join(".")}: ${err.message}`)
      .join("\n");
    console.error("❌ Invalid environment variables configuration:\n" + formattedErrors);
  } else {
    console.error("❌ Unknown error validating environment variables:", error);
  }
  process.exit(1);
}

export { env };
