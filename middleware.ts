import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { APP_PATHS, AUTH_QUERY_PARAMS, SESSION_COOKIE_NAME } from "@/lib/utils/constants";

const PROTECTED_APP_PATHS = [
  APP_PATHS.dashboard,
  APP_PATHS.workOrders,
  APP_PATHS.clientOrganizations,
  APP_PATHS.locations,
  APP_PATHS.contractors,
  APP_PATHS.finance,
  APP_PATHS.settings,
] as const;

export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const { pathname, search } = request.nextUrl;

  if (isProtectedAppPath(pathname) && !sessionCookie) {
    const signInUrl = new URL(APP_PATHS.signIn, request.url);
    signInUrl.searchParams.set(AUTH_QUERY_PARAMS.next, `${pathname}${search}`);
    return NextResponse.redirect(signInUrl);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/work-orders/:path*",
    "/client-organizations/:path*",
    "/locations/:path*",
    "/contractors/:path*",
    "/finance/:path*",
    "/settings/:path*",
  ],
};

function isProtectedAppPath(pathname: string): boolean {
  return PROTECTED_APP_PATHS.some(
    (protectedPath) =>
      pathname === protectedPath || pathname.startsWith(`${protectedPath}/`),
  );
}
