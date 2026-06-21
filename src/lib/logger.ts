/**
 * Production-safe structured logger utility.
 * - DEV mode: prints all levels with full context
 * - PROD mode: only errors are printed (with structured metadata)
 *
 * Usage:
 *   logger.info('User logged in', { userId: '123' });
 *   logger.error('Failed to fetch', { url, status });
 */

const isDev = import.meta.env.DEV;

const SENSITIVE_KEY_RE = /(token|secret|password|authorization|cookie|api[_-]?key|jwt)/i;

/** Error properties are non-enumerable; serialize explicitly so logs keep message/stack. */
function serializeError(err: Error): Record<string, unknown> {
  return { name: err.name, message: err.message, stack: err.stack };
}

function redactValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Error) return serializeError(value);
  if (Array.isArray(value)) return value.map((item) => redactValue(item));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY_RE.test(key) ? '[REDACTED]' : redactValue(nested);
    }
    return out;
  }
  return value;
}

type LogLevel = 'debug' | 'error' | 'info' | 'warn';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

function formatEntry(level: LogLevel, message: string, data?: Record<string, unknown>): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(data && Object.keys(data).length > 0
      ? { data: redactValue(data) as Record<string, unknown> }
      : {}),
  };
}

function extractData(args: unknown[]): Record<string, unknown> | undefined {
  if (args.length === 0) return undefined;
  if (args.length === 1 && args[0] instanceof Error) {
    return { error: serializeError(args[0]) };
  }
  if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
    return args[0] as Record<string, unknown>;
  }
  return { details: args.map((a) => (a instanceof Error ? serializeError(a) : a)) };
}

export const logger = {
  debug(message: string, ...args: unknown[]): void {
    if (isDev) {
      const entry = formatEntry('debug', message, extractData(args));
      console.warn(JSON.stringify(entry));
    }
  },

  log(message: string, ...args: unknown[]): void {
    if (isDev) {
      const entry = formatEntry('info', message, extractData(args));
      console.warn(JSON.stringify(entry));
    }
  },

  info(message: string, ...args: unknown[]): void {
    if (isDev) {
      const entry = formatEntry('info', message, extractData(args));
      console.warn(JSON.stringify(entry));
    }
  },

  warn(message: string, ...args: unknown[]): void {
    if (isDev) {
      const entry = formatEntry('warn', message, extractData(args));
      console.warn(JSON.stringify(entry));
    }
  },

  error(message: string, ...args: unknown[]): void {
    // Always log errors, even in production
    const entry = formatEntry('error', message, extractData(args));
    console.error(JSON.stringify(entry));
  },
};
