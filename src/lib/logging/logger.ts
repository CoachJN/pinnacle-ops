import { AppError, isAppError } from "../errors/app-error.ts";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface StructuredLogContext {
  requestId?: string;
  actor?: {
    type?: "user" | "system";
    userId?: string | null;
    role?: string;
  };
  resource?: {
    type?: string;
    id?: string;
    label?: string | null;
  };
  [key: string]: unknown;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  message?: string;
  context?: StructuredLogContext;
  error?: Record<string, unknown>;
}

const SENSITIVE_KEY_PATTERN =
  /(authorization|cookie|password|secret|token|api[-_]?key|session|credential|set-cookie|firebase[-_]?config)/i;

const MAX_DEPTH = 5;
const MAX_ARRAY_LENGTH = 25;

export interface AppLogger {
  debug(event: string, context?: StructuredLogContext): void;
  info(event: string, context?: StructuredLogContext): void;
  warn(event: string, context?: StructuredLogContext): void;
  error(
    event: string,
    error: unknown,
    context?: StructuredLogContext,
  ): void;
  child(defaultContext: StructuredLogContext): AppLogger;
}

export function createAppLogger(
  defaultContext: StructuredLogContext = {},
): AppLogger {
  return {
    debug(event, context) {
      writeLog("debug", event, undefined, mergeContexts(defaultContext, context));
    },
    info(event, context) {
      writeLog("info", event, undefined, mergeContexts(defaultContext, context));
    },
    warn(event, context) {
      writeLog("warn", event, undefined, mergeContexts(defaultContext, context));
    },
    error(event, error, context) {
      writeLog(
        "error",
        event,
        serializeError(error),
        mergeContexts(defaultContext, context),
      );
    },
    child(childContext) {
      return createAppLogger(mergeContexts(defaultContext, childContext));
    },
  };
}

function writeLog(
  level: LogLevel,
  event: string,
  error: Record<string, unknown> | undefined,
  context: StructuredLogContext,
): void {
  const entry: StructuredLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    context: sanitizeForLogging(context) as StructuredLogContext,
  };

  if (error) {
    entry.error = sanitizeForLogging(error) as Record<string, unknown>;
  }

  const line = JSON.stringify(entry);
  switch (level) {
    case "debug":
    case "info":
      console.info(line);
      return;
    case "warn":
      console.warn(line);
      return;
    case "error":
      console.error(line);
      return;
  }
}

function mergeContexts(
  base: StructuredLogContext,
  override: StructuredLogContext = {},
): StructuredLogContext {
  return {
    ...base,
    ...override,
    actor:
      base.actor || override.actor
        ? {
            ...base.actor,
            ...override.actor,
          }
        : undefined,
    resource:
      base.resource || override.resource
        ? {
            ...base.resource,
            ...override.resource,
          }
        : undefined,
  };
}

export function sanitizeForLogging(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof AppError || isAppError(value)) {
    return serializeError(value);
  }

  if (value instanceof Error) {
    return serializeError(value);
  }

  if (depth >= MAX_DEPTH) {
    return "[Truncated]";
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((item) => sanitizeForLogging(item, depth + 1, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value as object)) {
      return "[Circular]";
    }
    seen.add(value as object);

    const output: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      output[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? "[REDACTED]"
        : sanitizeForLogging(nestedValue, depth + 1, seen);
    }
    return output;
  }

  return String(value);
}

function serializeError(error: unknown): Record<string, unknown> {
  if (isAppError(error)) {
    return {
      name: error.name,
      code: error.code,
      statusCode: error.statusCode,
      message: error.message,
      safeMessage: error.safeMessage,
      cause: serializeError(error.cause),
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack:
        process.env.NODE_ENV === "production" ? undefined : error.stack,
      cause: serializeError(error.cause),
    };
  }

  if (error === undefined) {
    return {};
  }

  return {
    value: sanitizeForLogging(error),
  };
}
