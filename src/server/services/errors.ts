import "server-only";

import { AppError } from "../../lib/errors/app-error.ts";
import { ERROR_CODES } from "../../lib/errors/codes.ts";

export function validationError(message: string, cause?: unknown): AppError {
  return new AppError({
    code: ERROR_CODES.ValidationFailed,
    message,
    safeMessage: message,
    cause,
  });
}

export function notFoundError(message: string, cause?: unknown): AppError {
  return new AppError({
    code: ERROR_CODES.NotFound,
    message,
    safeMessage: message,
    cause,
  });
}

export function conflictError(message: string, cause?: unknown): AppError {
  return new AppError({
    code: ERROR_CODES.Conflict,
    message,
    safeMessage: message,
    cause,
  });
}

export function invalidTransitionError(message: string, cause?: unknown): AppError {
  return conflictError(message, cause);
}
