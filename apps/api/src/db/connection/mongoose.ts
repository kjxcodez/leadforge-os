import mongoose from 'mongoose';
import { logger, dbConfig } from '../../config/index.js';

// Register global Mongoose plugin to normalize all serialized MongoDB documents
mongoose.plugin((schema: mongoose.Schema) => {
  const existingJSON = schema.get('toJSON') ?? {};
  schema.set('toJSON', {
    ...existingJSON,
    virtuals: true,
    versionKey: false,
    transform(doc: any, ret: any, options: any) {
      if (existingJSON && typeof existingJSON.transform === 'function') {
        ret = existingJSON.transform(doc, ret, options) || ret;
      }
      if (ret._id) {
        ret.id = typeof ret._id === 'object' ? ret._id.toString() : ret._id;
      }
      delete (ret as any)._id;
      delete (ret as any).__v;
      return ret;
    }
  } as any);

  const existingObject = schema.get('toObject') ?? {};
  schema.set('toObject', {
    ...existingObject,
    virtuals: true,
    versionKey: false,
    transform(doc: any, ret: any, options: any) {
      if (existingObject && typeof existingObject.transform === 'function') {
        ret = existingObject.transform(doc, ret, options) || ret;
      }
      if (ret._id) {
        ret.id = typeof ret._id === 'object' ? ret._id.toString() : ret._id;
      }
      delete (ret as any)._id;
      delete (ret as any).__v;
      return ret;
    }
  } as any);
});

/**
 * Singleton database connection manager.
 */
class DatabaseManager {
  private static instance: DatabaseManager;
  private isConnected = false;

  private connectPromise: Promise<void> | null = null;

  private constructor() {
    // Register Mongoose connection events
    mongoose.connection.on('connected', () => {
      this.isConnected = true;
      logger.info('🔌 MongoDB database connection established successfully.');
    });

    mongoose.connection.on('error', (err) => {
      this.isConnected = false;
      logger.error({ err }, '❌ MongoDB database connection error:');
    });

    mongoose.connection.on('disconnected', () => {
      this.isConnected = false;
      logger.warn('🔌 MongoDB database disconnected.');
    });
  }

  /**
   * Retrieves the DatabaseManager singleton instance.
   */
  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Connects to the MongoDB instance if not already connected.
   */
  public async connect(): Promise<void> {
    if (this.isConnected || mongoose.connection.readyState === 1) {
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = (async () => {
      const retryLimit = 5;
      let attempt = 0;

      while (attempt < retryLimit) {
        try {
          attempt++;
          logger.info(`Connecting to MongoDB... (Attempt ${attempt}/${retryLimit})`);
          await mongoose.connect(dbConfig.uri, dbConfig.options);
          this.isConnected = true;
          this.connectPromise = null;
          return;
        } catch (error) {
          logger.error({ error, attempt }, `Failed to connect to MongoDB on attempt ${attempt}.`);
          if (attempt >= retryLimit) {
            this.connectPromise = null;
            logger.fatal('Database connection attempts exhausted. Shutting down.');
            throw error;
          }
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    })();

    return this.connectPromise;
  }

  /**
   * Disconnects the database connection gracefully.
   */
  public async disconnect(): Promise<void> {
    if (mongoose.connection.readyState !== 0) {
      logger.info('Disconnecting from MongoDB gracefully...');
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info('MongoDB disconnected successfully.');
    }
  }

  /**
   * Performs a health check on the database connection.
   */
  public async checkHealth(): Promise<{ isHealthy: boolean; readyState: number }> {
    const state = mongoose.connection.readyState;
    const isHealthy = state === 1;
    return {
      isHealthy,
      readyState: state
    };
  }
}

export const db = DatabaseManager.getInstance();
