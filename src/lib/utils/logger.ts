type LogLevel = "debug" | "info" | "warn" | "error";
type LogMetadata = Record<string, unknown>;

export interface Logger {
  debug(message: string, metadata?: LogMetadata): void;
  info(message: string, metadata?: LogMetadata): void;
  warn(message: string, metadata?: LogMetadata): void;
  error(message: string, metadata?: LogMetadata): void;
  child(defaultMetadata: LogMetadata): Logger;
}

const SENSITIVE_KEY_PATTERN =
  /(authorization|cookie|password|secret|token|api[-_]?key|session|credential|set-cookie)/i;

const LOG_LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const ACTIVE_LOG_LEVEL = resolveActiveLogLevel();

export const logger = createLogger();

export function createLogger(defaultMetadata: LogMetadata = {}): Logger {
  return {
    debug(message, metadata) {
      writeLog("debug", message, mergeMetadata(defaultMetadata, metadata));
    },
    info(message, metadata) {
      writeLog("info", message, mergeMetadata(defaultMetadata, metadata));
    },
    warn(message, metadata) {
      writeLog("warn", message, mergeMetadata(defaultMetadata, metadata));
    },
    error(message, metadata) {
      writeLog("error", message, mergeMetadata(defaultMetadata, metadata));
    },
    child(childMetadata) {
      return createLogger(mergeMetadata(defaultMetadata, childMetadata));
    },
  };
}

function writeLog(
  level: LogLevel,
  message: string,
  metadata: LogMetadata = {},
): void {
  if (!shouldLog(level)) {
    return;
  }

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...sanitizeMetadata(metadata),
  };

  if (process.env.NODE_ENV === "production") {
    consoleForLevel(level)(JSON.stringify(payload));
    return;
  }

  consoleForLevel(level)(payload);
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_RANK[level] >= LOG_LEVEL_RANK[ACTIVE_LOG_LEVEL];
}

function resolveActiveLogLevel(): LogLevel {
  switch (process.env.NODE_ENV) {
    case "production":
      return "info";
    case "test":
      return "warn";
    default:
      return "debug";
  }
}

function consoleForLevel(level: LogLevel): typeof console.info {
  switch (level) {
    case "debug":
    case "info":
      return console.info;
    case "warn":
      return console.warn;
    case "error":
      return console.error;
  }
}

function mergeMetadata(
  base: LogMetadata,
  override?: LogMetadata,
): LogMetadata {
  if (!override) {
    return { ...base };
  }

  return {
    ...base,
    ...override,
  };
}

function sanitizeMetadata(metadata: LogMetadata): LogMetadata {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : sanitizeValue(value),
    ]),
  );
}

function sanitizeValue(value: unknown): unknown {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: process.env.NODE_ENV === "production" ? undefined : value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (typeof value === "object") {
    return sanitizeMetadata(value as LogMetadata);
  }

  return String(value);
}
