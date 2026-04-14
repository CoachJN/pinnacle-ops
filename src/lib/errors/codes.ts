export const ERROR_CODES = {
  Unknown: "unknown",
  ValidationFailed: "validation_failed",
  Unauthorized: "unauthorized",
  Forbidden: "forbidden",
  NotFound: "not_found",
  Conflict: "conflict",
  ExternalServiceUnavailable: "external_service_unavailable",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

