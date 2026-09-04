import { pino } from 'pino';

export interface LoggerConfig {
  env: 'development' | 'production' | 'test';
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
}

const NON_SENSITIVE_KEYS = new Set([
  'idempotencykey',
  'cachekey',
  'sortkey',
  'foreignkey',
  'partitionkey',
  'primarykey'
]);
const SENSITIVE_KEY_REGEX = /(token|secret|password|auth|cookie|credential|refresh|private|^key$|apikey|secretkey|accesskey|privatekey)/i;
const SENSITIVE_BODY_KEYS = new Set(['html', 'htmlBody', 'textBody', 'body', 'rawPayload', 'contentBase64', 'data']);

/**
 * Recursively deep-redacts sensitive fields, credentials, and bulky payloads from log metadata.
 */
export function redactSensitiveData(obj: any, seen = new WeakSet()): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (seen.has(obj)) {
    return '[CIRCULAR]';
  }
  seen.add(obj);

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item, seen));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Skip known non-sensitive identifier keys (e.g. idempotencyKey)
    if (NON_SENSITIVE_KEYS.has(lowerKey)) {
      sanitized[key] = value;
      continue;
    }

    // 1. Redact credentials, tokens, keys, passwords
    if (SENSITIVE_KEY_REGEX.test(lowerKey)) {
      if (typeof value === 'string' && value.length > 0) {
        sanitized[key] = '[REDACTED]';
        continue;
      }
    }

    // 2. Suppress bulky email payloads and base64 binaries
    if (SENSITIVE_BODY_KEYS.has(key)) {
      if (typeof value === 'string' && value.length > 80) {
        sanitized[key] = `[PAYLOAD_TRUNCATED: ${value.length} chars]`;
        continue;
      }
    }

    // 3. Redact common header objects
    if (lowerKey === 'headers' && typeof value === 'object' && value !== null) {
      const sanitizedHeaders: Record<string, any> = {};
      for (const [hKey, hVal] of Object.entries(value)) {
        if (/(authorization|cookie|set-cookie|proxy-authorization)/i.test(hKey)) {
          sanitizedHeaders[hKey] = '[REDACTED]';
        } else {
          sanitizedHeaders[hKey] = hVal;
        }
      }
      sanitized[key] = sanitizedHeaders;
      continue;
    }

    // 4. Recurse for nested objects
    if (typeof value === 'object' && value !== null) {
      sanitized[key] = redactSensitiveData(value, seen);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export type OperationalEventName =
  | 'worker.started'
  | 'worker.stopped'
  | 'worker.crashed'
  | 'campaign.execution.started'
  | 'campaign.execution.completed'
  | 'campaign.execution.failed'
  | 'email.send.started'
  | 'email.send.accepted'
  | 'email.send.failed'
  | 'email.send.ambiguous'
  | 'email.send.reconciled'
  | 'gmail.poll.started'
  | 'gmail.poll.completed'
  | 'gmail.poll.failed'
  | 'gmail.reply.correlated'
  | 'gmail.reply.unmatched'
  | 'job.retry.scheduled'
  | 'job.retry.started'
  | 'job.retry.exhausted'
  | 'scheduler.started'
  | 'scheduler.stopped'
  | 'scheduler.stalled'
  | 'scheduler.recovered'
  | string;

export interface OperationalLogContext {
  workspaceId?: string;
  campaignId?: string;
  sequenceId?: string;
  executionId?: string;
  deliveryId?: string;
  jobId?: string;
  workerId?: string;
  attempt?: number;
  maxAttempts?: number;
  provider?: string;
  errorCode?: string;
  safeMessage?: string;
  technicalMessage?: string;
  retryable?: boolean;
  correlationId?: string;
  durationMs?: number;
  [key: string]: any;
}

export function createLogger(config: LoggerConfig) {
  const isBrowser = typeof globalThis !== 'undefined' && (globalThis as any).window !== undefined;

  const instance: any = isBrowser
    ? pino({
        level: config.logLevel,
        browser: {
          asObject: true
        }
      })
    : pino({
        level: config.logLevel,
        redact: {
          paths: [
            '*.token',
            '*.accessToken',
            '*.refreshToken',
            '*.sessionToken',
            '*.password',
            '*.secret',
            '*.apiKey',
            '*.client_secret',
            'headers.authorization',
            'headers.cookie'
          ],
          censor: '[REDACTED]'
        },
        ...(config.env === 'development'
          ? {
              transport: {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  translateTime: 'HH:MM:ss Z',
                  ignore: 'pid,hostname'
                }
              }
            }
          : {})
      } as any);

  // Extend pino with an operational event emitter
  return Object.assign(instance, {
    operational: (
      eventName: OperationalEventName,
      context: OperationalLogContext = {},
      severity: 'info' | 'warn' | 'error' = 'info'
    ) => {
      const cleanContext = redactSensitiveData({
        eventName,
        ...context
      });
      instance[severity](cleanContext, `[OP] ${eventName}`);
    }
  });
}

// Default export/instance if process.env is available (Node)
let defaultLogger: any;
try {
  if (typeof process !== 'undefined' && process.env) {
    defaultLogger = createLogger({
      env: (process.env.NODE_ENV as any) || 'development',
      logLevel: (process.env.LOG_LEVEL as any) || 'info'
    });
  } else {
    defaultLogger = pino({ browser: { asObject: true } });
  }
} catch (e) {
  defaultLogger = pino({ browser: { asObject: true } });
}

export const logger = defaultLogger;
export type Logger = ReturnType<typeof createLogger>;
