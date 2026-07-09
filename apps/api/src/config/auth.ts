import { betterAuth } from "better-auth";
import { dbConfig, authConfig } from "./index.js";

/**
 * Configure and export the Better Auth instance.
 * Exclusively using Credentials provider with Node.js/Mongoose backing.
 */
export const auth = betterAuth({
  secret: authConfig.secret,
  baseURL: authConfig.url,
  database: {
    // Better Auth can accept a database connection configuration.
    // For Mongoose backend, we provide MongoDB URL or rely on internal session mappings.
    // Let's pass standard Better Auth database connection mapping.
    db: dbConfig.uri,
    provider: "mongodb",
  },
  providers: [
    {
      id: "credential",
      name: "Credentials",
      // Better Auth configuration options for credentials authentication
      async authorize(credentials: Record<string, unknown>) {
        // Better Auth authorization hook placeholder.
        return null;
      },
    },
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
});
