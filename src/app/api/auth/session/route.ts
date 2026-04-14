import { NextRequest, NextResponse } from "next/server";
import {
  buildSessionCookie,
  createSessionFromIdToken,
} from "@/lib/auth/session";
import type { AuthResponse } from "@/lib/auth/auth-types";
import {
  formatApiError,
  AuthenticationError,
  ValidationError,
} from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";
import { AUTH_MESSAGES } from "@/lib/utils/constants";
import {
  parseSessionRequestPayload,
  safeParseRequestJson,
} from "@/lib/validation/common";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    const { payload, statusCode } = formatApiError(
      new ValidationError(AUTH_MESSAGES.invalidOrigin, {
        safeMessage: AUTH_MESSAGES.invalidOrigin,
        statusCode: 403,
      }),
    );

    logger.warn("Rejected auth session request with mismatched origin.", {
      origin: request.headers.get("origin"),
      expectedOrigin: request.nextUrl.origin,
      route: request.nextUrl.pathname,
    });

    return NextResponse.json<AuthResponse>(
      { ok: false, error: payload.error },
      { status: statusCode },
    );
  }

  const parsedRequest = await safeParseRequestJson(
    request,
    parseSessionRequestPayload,
  );

  if (!parsedRequest.success) {
    const { payload, statusCode } = formatApiError(parsedRequest.error);
    return NextResponse.json<AuthResponse>(
      { ok: false, error: payload.error },
      { status: statusCode },
    );
  }

  try {
    const session = await createSessionFromIdToken(parsedRequest.data.idToken);
    const response = NextResponse.json<AuthResponse>({
      ok: true,
      user: session.user,
    });

    response.cookies.set(buildSessionCookie(session.sessionCookie));

    return response;
  } catch (error) {
    const formattedError = formatApiError(
      new AuthenticationError("Failed to create an authenticated session.", {
        safeMessage: AUTH_MESSAGES.sessionCreationFailed,
        cause: error,
      }),
    );

    logger.error("Failed to establish auth session.", {
      route: request.nextUrl.pathname,
      error,
    });

    return NextResponse.json<AuthResponse>(
      { ok: false, error: formattedError.payload.error },
      { status: formattedError.statusCode },
    );
  }
}

function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  return origin === request.nextUrl.origin;
}
