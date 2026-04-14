import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/auth/session";
import { formatApiError, ValidationError } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";
import { AUTH_MESSAGES } from "@/lib/utils/constants";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    const { payload, statusCode } = formatApiError(
      new ValidationError(AUTH_MESSAGES.invalidOrigin, {
        safeMessage: AUTH_MESSAGES.invalidOrigin,
        statusCode: 403,
      }),
    );

    logger.warn("Rejected auth logout request with mismatched origin.", {
      origin: request.headers.get("origin"),
      expectedOrigin: request.nextUrl.origin,
      route: request.nextUrl.pathname,
    });

    return NextResponse.json(payload, { status: statusCode });
  }

  const response = NextResponse.json({ ok: true });

  response.cookies.set(clearSession());

  return response;
}

function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  return origin === request.nextUrl.origin;
}
