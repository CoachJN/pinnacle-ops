import { AppError, isAppError } from "./app-error.ts";
import { ERROR_CODES } from "./codes.ts";
import {
  type AppError as LegacyAppError,
} from "@/lib/utils/errors";

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

  if (isLegacyAppErrorLike(error)) {
    return fromLegacyAppError(error);
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

function fromLegacyAppError(error: LegacyAppError): AppError {
  return new AppError({
    code: mapLegacyErrorCode(error.code),
    message: error.message,
    safeMessage: error.safeMessage,
    statusCode: error.statusCode,
    cause: error.cause,
  });
}

function isLegacyAppErrorLike(error: unknown): error is LegacyAppError {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    typeof (error as LegacyAppError).code === "string" &&
    typeof (error as LegacyAppError).safeMessage === "string" &&
    typeof (error as LegacyAppError).statusCode === "number"
  );
}

function mapLegacyErrorCode(code: LegacyAppError["code"]) {
  switch (code) {
    case "AUTHENTICATION_ERROR":
      return ERROR_CODES.Unauthorized;
    case "AUTHORIZATION_ERROR":
      return ERROR_CODES.Forbidden;
    case "REQUEST_PARSING_ERROR":
    case "VALIDATION_ERROR":
      return ERROR_CODES.ValidationFailed;
    case "INTERNAL_ERROR":
      return ERROR_CODES.Unknown;
  }
}
