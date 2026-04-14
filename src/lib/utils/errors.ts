export type AppErrorCode =
  | "AUTHENTICATION_ERROR"
  | "AUTHORIZATION_ERROR"
  | "REQUEST_PARSING_ERROR"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export interface AppErrorOptions {
  code: AppErrorCode;
  message: string;
  safeMessage?: string;
  statusCode?: number;
  cause?: unknown;
  details?: Record<string, unknown>;
}

export interface ApiErrorPayload {
  error: {
    code: AppErrorCode;
    message: string;
  };
}

export interface FormattedApiError {
  payload: ApiErrorPayload;
  statusCode: number;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly safeMessage: string;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(options: AppErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "AppError";
    this.code = options.code;
    this.safeMessage = options.safeMessage ?? options.message;
    this.statusCode = options.statusCode ?? 500;
    this.details = options.details;
  }
}

export class AuthenticationError extends AppError {
  constructor(
    message = "Authentication is required.",
    options: Omit<Partial<AppErrorOptions>, "code" | "message"> = {},
  ) {
    super({
      ...options,
      code: "AUTHENTICATION_ERROR",
      message,
      safeMessage: options.safeMessage ?? "Authentication is required.",
      statusCode: options.statusCode ?? 401,
    });
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends AppError {
  constructor(
    message = "You do not have access to this resource.",
    options: Omit<Partial<AppErrorOptions>, "code" | "message"> = {},
  ) {
    super({
      ...options,
      code: "AUTHORIZATION_ERROR",
      message,
      safeMessage:
        options.safeMessage ?? "You do not have access to this resource.",
      statusCode: options.statusCode ?? 403,
    });
    this.name = "AuthorizationError";
  }
}

export class ValidationError extends AppError {
  constructor(
    message = "Invalid input.",
    options: Omit<Partial<AppErrorOptions>, "code" | "message"> = {},
  ) {
    super({
      ...options,
      code: "VALIDATION_ERROR",
      message,
      safeMessage: options.safeMessage ?? "Invalid input.",
      statusCode: options.statusCode ?? 400,
    });
    this.name = "ValidationError";
  }
}

export class RequestParsingError extends AppError {
  constructor(
    message = "Unable to parse the request.",
    options: Omit<Partial<AppErrorOptions>, "code" | "message"> = {},
  ) {
    super({
      ...options,
      code: "REQUEST_PARSING_ERROR",
      message,
      safeMessage: options.safeMessage ?? "Unable to parse the request.",
      statusCode: options.statusCode ?? 400,
    });
    this.name = "RequestParsingError";
  }
}

export class InternalServerError extends AppError {
  constructor(
    message = "An unexpected error occurred.",
    options: Omit<Partial<AppErrorOptions>, "code" | "message"> = {},
  ) {
    super({
      ...options,
      code: "INTERNAL_ERROR",
      message,
      safeMessage: options.safeMessage ?? "Something went wrong.",
      statusCode: options.statusCode ?? 500,
    });
    this.name = "InternalServerError";
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function isAuthenticationError(
  error: unknown,
): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

export function isAuthorizationError(
  error: unknown,
): error is AuthorizationError {
  return error instanceof AuthorizationError;
}

export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalServerError(error.message, { cause: error });
  }

  return new InternalServerError("Unknown error.");
}

export function formatApiError(error: unknown): FormattedApiError {
  const appError = toAppError(error);

  return {
    statusCode: appError.statusCode,
    payload: {
      error: {
        code: appError.code,
        message: appError.safeMessage,
      },
    },
  };
}
