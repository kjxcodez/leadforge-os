import mongoose from "mongoose";
import { logger, dbConfig } from "../config/index.js";

/**
 * Singleton database connection manager.
 */
class DatabaseManager {
  private static instance: DatabaseManager;
  private isConnected = false;

  private constructor() {
    // Prevent direct instantiation

    // Register Mongoose connection events
    mongoose.connection.on("connected", () => {
      this.isConnected = true;
      logger.info("🔌 MongoDB database connection established successfully.");
    });

    mongoose.connection.on("error", (err) => {
      this.isConnected = false;
      logger.error({ err }, "❌ MongoDB database connection error:");
    });

    mongoose.connection.on("disconnected", () => {
      this.isConnected = false;
      logger.warn("🔌 MongoDB database disconnected.");
    });
  }

  /**
   * Retrieves the DatabaseManager singleton instance.
   *
   * @returns DatabaseManager
   */
  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Connects to the MongoDB instance if not already connected.
   * Prevents duplicate connections during hot reload environments.
   *
   * @returns Promise<void>
   */
  public async connect(): Promise<void> {
    // If we're already connected, do not re-establish
    if (this.isConnected || mongoose.connection.readyState === 1) {
      logger.debug("MongoDB connection is already active. Reusing existing connection.");
      return;
    }

    // Handle other readyStates (connecting/disconnecting)
    if (mongoose.connection.readyState === 2) {
      logger.info("MongoDB connection is currently connecting. Awaiting completion...");
      return;
    }

    const retryLimit = 5;
    let attempt = 0;

    while (attempt < retryLimit) {
      try {
        attempt++;
        logger.info(`Connecting to MongoDB... (Attempt ${attempt}/${retryLimit})`);
        await mongoose.connect(dbConfig.uri, dbConfig.options);
        return;
      } catch (error) {
        logger.error(
          { error, attempt },
          `Failed to connect to MongoDB on attempt ${attempt}.`
        );
        if (attempt >= retryLimit) {
          logger.fatal("Database connection attempts exhausted. Shutting down.");
          throw error;
        }
        // Wait 2 seconds before retrying
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  /**
   * Disconnects the database connection gracefully.
   *
   * @returns Promise<void>
   */
  public async disconnect(): Promise<void> {
    if (mongoose.connection.readyState !== 0) {
      logger.info("Disconnecting from MongoDB gracefully...");
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info("MongoDB disconnected successfully.");
    }
  }

  /**
   * Performs a health check check on the database connection.
   *
   * @returns Promise<{ isHealthy: boolean; readyState: number }>
   */
  public async checkHealth(): Promise<{ isHealthy: boolean; readyState: number }> {
    const state = mongoose.connection.readyState;
    const isHealthy = state === 1;
    return {
      isHealthy,
      readyState: state,
    };
  }
}

export const db = DatabaseManager.getInstance();
