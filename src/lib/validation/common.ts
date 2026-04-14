import {
  AppError,
  RequestParsingError,
  ValidationError,
} from "@/lib/utils/errors";
import { AUTH_MESSAGES } from "@/lib/utils/constants";

const EMAIL_PATTERN =
  /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;

export interface SessionRequestPayload {
  idToken: string;
}

export type UnknownRecord = Record<string, unknown>;

export type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: AppError };

export function isPlainObject(value: unknown): value is UnknownRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function readOptionalString(value: unknown): string | undefined {
  return isNonEmptyString(value) ? value.trim() : undefined;
}

export function requireString(value: unknown, fieldName: string): string {
  const parsedValue = readOptionalString(value);

  if (!parsedValue) {
    throw new ValidationError(`Invalid ${fieldName}.`);
  }

  return parsedValue;
}

export function isEmail(value: unknown): value is string {
  return typeof value === "string" && EMAIL_PATTERN.test(value.trim());
}

export function readOptionalEmail(value: unknown): string | undefined {
  if (!isEmail(value)) {
    return undefined;
  }

  return value.trim().toLowerCase();
}

export function requireEmail(value: unknown, fieldName = "email"): string {
  const email = readOptionalEmail(value);

  if (!email) {
    throw new ValidationError(`Invalid ${fieldName}.`);
  }

  return email;
}

export function requirePlainObject(
  value: unknown,
  message = "Invalid request body.",
): UnknownRecord {
  if (!isPlainObject(value)) {
    throw new ValidationError(message);
  }

  return value;
}

export function parseSessionRequestPayload(value: unknown): SessionRequestPayload {
  const payload = requirePlainObject(value);
  const idToken = readOptionalString(payload.idToken);

  if (!idToken) {
    throw new ValidationError(AUTH_MESSAGES.missingIdToken, {
      safeMessage: AUTH_MESSAGES.missingIdToken,
    });
  }

  return {
    idToken,
  };
}

export function safeParse<T>(
  value: unknown,
  parser: (value: unknown) => T,
): SafeParseResult<T> {
  try {
    return {
      success: true,
      data: parser(value),
    };
  } catch (error) {
    return {
      success: false,
      error: normalizeParseError(error),
    };
  }
}

export async function safeParseRequestJson<T>(
  request: Request,
  parser: (value: unknown) => T,
): Promise<SafeParseResult<T>> {
  try {
    const body = await request.json();
    return safeParse(body, parser);
  } catch (error) {
    return {
      success: false,
      error: normalizeParseError(
        error instanceof AppError
          ? error
          : new RequestParsingError("Request body must be valid JSON.", {
              cause: error,
            }),
      ),
    };
  }
}

function normalizeParseError(error: unknown): AppError {
  if (error instanceof ValidationError || error instanceof RequestParsingError) {
    return error;
  }

  if (error instanceof Error) {
    return new ValidationError(error.message, { cause: error });
  }

  return new ValidationError("Invalid request.");
}
