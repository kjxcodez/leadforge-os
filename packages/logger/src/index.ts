import { pino } from 'pino';

export interface LoggerConfig {
  env: 'development' | 'production' | 'test';
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
}

export function createLogger(config: LoggerConfig) {
  const isBrowser = typeof globalThis !== 'undefined' && (globalThis as any).window !== undefined;

  if (isBrowser) {
    return pino({
      level: config.logLevel,
      browser: {
        asObject: true
      }
    });
  }

  const options: Record<string, any> = {
    level: config.logLevel,
  };

  if (config.env === 'development') {
    options.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    };
  }

  return pino(options as any);
}

// Default export/instance if process.env is available (Node)
let defaultLogger;
try {
  if (typeof process !== 'undefined' && process.env) {
    defaultLogger = createLogger({
      env: (process.env.NODE_ENV as any) || 'development',
      logLevel: (process.env.LOG_LEVEL as any) || 'info',
    });
  } else {
    defaultLogger = pino({ browser: { asObject: true } });
  }
} catch (e) {
  defaultLogger = pino({ browser: { asObject: true } });
}

export const logger = defaultLogger;
export type Logger = ReturnType<typeof createLogger>;
