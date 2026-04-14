import { ERROR_CODES, type ErrorCode } from "./codes.ts";

export interface AppErrorOptions {
  code: ErrorCode;
  message: string;
  statusCode?: number;
  cause?: unknown;
  safeMessage?: string;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly safeMessage: string;

  constructor(options: AppErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "AppError";
    this.code = options.code;
    this.statusCode = options.statusCode ?? statusCodeForErrorCode(options.code);
    this.safeMessage = options.safeMessage ?? defaultSafeMessage(options.code);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

function statusCodeForErrorCode(code: ErrorCode): number {
  switch (code) {
    case ERROR_CODES.ValidationFailed:
      return 400;
    case ERROR_CODES.Unauthorized:
      return 401;
    case ERROR_CODES.Forbidden:
      return 403;
    case ERROR_CODES.NotFound:
      return 404;
    case ERROR_CODES.Conflict:
      return 409;
    case ERROR_CODES.ExternalServiceUnavailable:
      return 503;
    case ERROR_CODES.Unknown:
      return 500;
  }
}

function defaultSafeMessage(code: ErrorCode): string {
  switch (code) {
    case ERROR_CODES.ValidationFailed:
      return "The request could not be validated.";
    case ERROR_CODES.Unauthorized:
      return "Sign in to continue.";
    case ERROR_CODES.Forbidden:
      return "You do not have access to this resource.";
    case ERROR_CODES.NotFound:
      return "The requested resource was not found.";
    case ERROR_CODES.Conflict:
      return "The request conflicts with the current resource state.";
    case ERROR_CODES.ExternalServiceUnavailable:
      return "A required service is temporarily unavailable.";
    case ERROR_CODES.Unknown:
      return "Something went wrong.";
  }
}
