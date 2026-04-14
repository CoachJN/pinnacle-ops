import "server-only";

import { redirect } from "next/navigation";
import type {
  AppRole,
  AuthGuardResult,
  AuthenticatedUser,
  RoleSubject,
  UserWithAllowedRole,
} from "@/lib/auth/auth-types";
import { getCurrentUser, requireCurrentUser } from "@/lib/auth/current-user";
import {
  canAccessAppShell,
  requireAppShellAccess,
  requireRole,
} from "@/lib/rbac/checks";
import { APP_PATHS } from "@/lib/utils/constants";
import {
  AuthenticationError,
  AuthorizationError,
} from "@/lib/utils/errors";

const UNAUTHORIZED_PATH = "/unauthorized";

export function unauthenticated(message?: string): AuthenticationError {
  return new AuthenticationError(message);
}

export function unauthorized(message?: string): AuthorizationError {
  return new AuthorizationError(message);
}

export function assertAuthenticated<TUser>(
  user: TUser | null | undefined,
  message?: string,
): TUser {
  if (!user) {
    throw unauthenticated(message);
  }

  return user;
}

export function assertRole<
  TUser extends RoleSubject,
  TAllowedRoles extends readonly AppRole[],
>(
  user: TUser | null | undefined,
  allowedRoles: TAllowedRoles,
  message?: string,
): UserWithAllowedRole<TUser, TAllowedRoles> {
  return requireRole(user, allowedRoles, message);
}

export function assertAppShellAccess<TUser extends RoleSubject>(
  user: TUser | null | undefined,
  message = "You do not have access to the application shell.",
): TUser {
  return requireAppShellAccess(assertAuthenticated(user), message);
}

export function guardAuthenticated<TUser>(
  user: TUser | null | undefined,
  message?: string,
): AuthGuardResult<TUser> {
  if (!user) {
    const error = unauthenticated(message);
    return {
      ok: false,
      reason: "unauthenticated",
      statusCode: 401,
      message: error.message,
    };
  }

  return {
    ok: true,
    user,
  };
}

export function guardRole<
  TUser extends RoleSubject,
  TAllowedRoles extends readonly AppRole[],
>(
  user: TUser | null | undefined,
  allowedRoles: TAllowedRoles,
  message?: string,
): AuthGuardResult<UserWithAllowedRole<TUser, TAllowedRoles>> {
  const authenticated = guardAuthenticated(user, message);

  if (!authenticated.ok) {
    return authenticated;
  }

  try {
    return {
      ok: true,
      user: assertRole(authenticated.user, allowedRoles, message),
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return {
        ok: false,
        reason: "unauthorized",
        statusCode: 403,
        message: error.message,
      };
    }

    throw error;
  }
}

export function guardAppShellAccess<TUser extends RoleSubject>(
  user: TUser | null | undefined,
  message = "You do not have access to the application shell.",
): AuthGuardResult<TUser> {
  const authenticated = guardAuthenticated(user);

  if (!authenticated.ok) {
    return authenticated;
  }

  if (!canAccessAppShell(authenticated.user)) {
    const error = unauthorized(message);
    return {
      ok: false,
      reason: "unauthorized",
      statusCode: 403,
      message: error.message,
    };
  }

  return authenticated;
}

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  return requireCurrentUser();
}

export async function requireUserWithRole<TAllowedRoles extends readonly AppRole[]>(
  allowedRoles: TAllowedRoles,
): Promise<UserWithAllowedRole<AuthenticatedUser, TAllowedRoles>> {
  const user = await requireCurrentUser();

  return assertRole(user, allowedRoles);
}

export async function guardCurrentUser(): Promise<
  AuthGuardResult<AuthenticatedUser>
> {
  return guardAuthenticated(await getCurrentUser());
}

export async function guardCurrentUserRole<
  TAllowedRoles extends readonly AppRole[],
>(
  allowedRoles: TAllowedRoles,
): Promise<AuthGuardResult<UserWithAllowedRole<AuthenticatedUser, TAllowedRoles>>> {
  return guardRole(await getCurrentUser(), allowedRoles);
}

export async function requireAppShellUser(): Promise<AuthenticatedUser> {
  return assertAppShellAccess(await requireCurrentUser());
}

export async function redirectIfCannotAccessAppShell(
  nextPath = APP_PATHS.dashboard,
): Promise<AuthenticatedUser> {
  const result = await guardCurrentAppShellUser();

  if (!result.ok) {
    if (result.reason === "unauthenticated") {
      redirect(`${APP_PATHS.signIn}?next=${encodeURIComponent(nextPath)}`);
    }

    redirect(UNAUTHORIZED_PATH);
  }

  return result.user;
}

export async function guardCurrentAppShellUser(): Promise<
  AuthGuardResult<AuthenticatedUser>
> {
  return guardAppShellAccess(await getCurrentUser());
}

export async function redirectIfUnauthenticated(
  nextPath = APP_PATHS.dashboard,
): Promise<AuthenticatedUser> {
  const result = await guardCurrentUser();

  if (!result.ok) {
    redirect(`${APP_PATHS.signIn}?next=${encodeURIComponent(nextPath)}`);
  }

  return result.user;
}
