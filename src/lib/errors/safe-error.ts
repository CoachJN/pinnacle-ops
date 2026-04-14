import { AppError, isAppError } from "./app-error.ts";
import { ERROR_CODES } from "./codes.ts";

export interface SafeErrorResponse {
  code: string;
  message: string;
  statusCode: number;
  requestId?: string;
}

export interface SafeErrorResponseOptions {
  requestId?: string;
}

export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  return new AppError({
    code: ERROR_CODES.Unknown,
    message: error instanceof Error ? error.message : "Unknown error",
    cause: error,
  });
}

export function toSafeErrorResponse(
  error: unknown,
  options: SafeErrorResponseOptions = {},
): SafeErrorResponse {
  const appError = toAppError(error);

  return {
    code: appError.code,
    message: appError.safeMessage,
    statusCode: appError.statusCode,
    requestId: options.requestId,
  };
}
