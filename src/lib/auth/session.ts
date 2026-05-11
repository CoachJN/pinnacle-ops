import "server-only";

import { cookies } from "next/headers";
import type { DecodedIdToken } from "firebase-admin/auth";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import type {
  AppRole,
  AuthSession,
  FirebaseCustomClaims,
  SessionUser,
} from "@/lib/auth/auth-types";
import { assertAppRole } from "@/lib/rbac/checks";
import {
  APP_PATHS,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
} from "@/lib/utils/constants";
import { AuthenticationError } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";
import { serverEnv } from "@/lib/env/server";
import {
  getCanonicalUserProfile,
  toCanonicalSessionProfile,
} from "@/server/auth/user-profile";

const authLogger = logger.child({ area: "auth-session" });

export async function createSessionFromIdToken(idToken: string): Promise<AuthSession> {
  const token = await getFirebaseAdminAuth().verifyIdToken(idToken, true);
  const user = await mapDecodedTokenToSessionUser(token);
  const sessionCookie = await getFirebaseAdminAuth().createSessionCookie(idToken, {
    expiresIn: SESSION_COOKIE_MAX_AGE_SECONDS * 1000,
  });

  return {
    sessionCookie,
    user,
    token,
  };
}

export async function createSessionCookieFromIdToken(
  idToken: string,
): Promise<string> {
  const session = await createSessionFromIdToken(idToken);

  return session.sessionCookie;
}

export async function getOptionalSession(): Promise<AuthSession | null> {
  const sessionCookie = await readSessionCookieValue();

  if (!sessionCookie) {
    return null;
  }

  return verifySessionCookieValue(sessionCookie);
}

export async function getOptionalSessionUser(): Promise<SessionUser | null> {
  const session = await getOptionalSession();
  return session?.user ?? null;
}

export async function requireSessionUser(): Promise<SessionUser> {
  const sessionUser = await getOptionalSessionUser();

  if (!sessionUser) {
    throw new AuthenticationError();
  }

  return sessionUser;
}

export async function getOptionalDecodedSessionToken(): Promise<DecodedIdToken | null> {
  const session = await getOptionalSession();
  return session?.token ?? null;
}

export async function requireDecodedSessionToken(): Promise<DecodedIdToken> {
  const decodedToken = await getOptionalDecodedSessionToken();

  if (!decodedToken) {
    throw new AuthenticationError();
  }

  return decodedToken;
}

export function buildSessionCookie(value: string) {
  return {
    name: SESSION_COOKIE_NAME,
    value,
    httpOnly: true,
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure: serverEnv.isProduction,
  };
}

export function buildClearedSessionCookie() {
  return {
    ...buildSessionCookie(""),
    maxAge: 0,
  };
}

export function clearSession() {
  return buildClearedSessionCookie();
}

export function getPostSignInRedirectPath(nextPath: string | null): string {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return APP_PATHS.dashboard;
  }

  return nextPath;
}

async function mapDecodedTokenToSessionUser(
  decodedToken: DecodedIdToken,
): Promise<SessionUser> {
  const claims = await readFirebaseCustomClaims(decodedToken);

  return {
    uid: decodedToken.uid,
    email: decodedToken.email ?? null,
    emailVerified: decodedToken.email_verified ?? false,
    displayName: typeof decodedToken.name === "string" ? decodedToken.name : null,
    photoURL: typeof decodedToken.picture === "string" ? decodedToken.picture : null,
    role: claims.role,
    organizationId: claims.organizationId ?? null,
    claims,
  };
}

async function readFirebaseCustomClaims(
  decodedToken: DecodedIdToken,
): Promise<FirebaseCustomClaims> {
  const roleFromToken = readRoleClaim(decodedToken.role);
  const organizationIdFromToken = readOptionalString(decodedToken.organizationId);
  const shouldReadProfile =
    roleFromToken === null || organizationIdFromToken === undefined;
  const profile = shouldReadProfile
    ? await resolveSessionProfileSafely(decodedToken.uid)
    : null;

  try {
    const role =
      roleFromToken ??
      profile?.role ??
      (serverEnv.isProduction ? null : readRoleClaim(serverEnv.devAuthRole));
    const organizationId =
      organizationIdFromToken ??
      profile?.organizationId ??
      (serverEnv.isProduction ? undefined : serverEnv.devOrganizationId);

    if (!role || !organizationId) {
      throw new Error("Missing application role or organization.");
    }

    return {
      role,
      organizationId,
      organizationIds: Array.isArray(decodedToken.organizationIds)
        ? decodedToken.organizationIds.filter(
            (value): value is string => typeof value === "string",
          )
        : undefined,
      permissionsVersion:
        typeof decodedToken.permissionsVersion === "number"
          ? decodedToken.permissionsVersion
          : undefined,
    };
  } catch (error) {
    authLogger.warn("Rejected session with invalid role claims.", {
      uid: decodedToken.uid,
      error,
    });
    throw new AuthenticationError(
      "Session is missing required role or organization claims.",
    );
  }
}

interface SessionProfile {
  role: AppRole | null;
  organizationId: string | undefined;
}

async function resolveSessionProfileSafely(
  uid: string,
): Promise<SessionProfile | null> {
  try {
    return await resolveSessionProfile(uid);
  } catch (error) {
    authLogger.warn("Failed to resolve session profile fallback.", {
      uid,
      error,
    });
    return null;
  }
}

async function resolveSessionProfile(uid: string): Promise<SessionProfile | null> {
  const profile = await getCanonicalUserProfile(uid);
  return toCanonicalSessionProfile(profile);
}

function readRoleClaim(value: unknown): AppRole | null {
  try {
    return assertAppRole(value);
  } catch {
    return null;
  }
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

async function readSessionCookieValue(): Promise<string | null> {
  const cookieStore = await cookies();

  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

async function verifySessionCookieValue(
  sessionCookie: string,
): Promise<AuthSession | null> {
  try {
    const token = await getFirebaseAdminAuth().verifySessionCookie(sessionCookie, true);
    const user = await mapDecodedTokenToSessionUser(token);

    return {
      sessionCookie,
      token,
      user,
    };
  } catch (error) {
    authLogger.warn("Failed to verify session cookie.", { error });
    return null;
  }
}
