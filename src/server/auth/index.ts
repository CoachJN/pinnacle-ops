import "server-only";

import { redirect } from "next/navigation";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { AuthenticatedUser } from "@/lib/auth/auth-types";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createSessionCookieFromIdToken } from "@/lib/auth/session";
import {
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
} from "@/lib/utils/constants";
import { buildLoginRedirectPath } from "./redirect-path";
import type { UserRole } from "@/types/permissions";
import {
  getCanonicalUserProfile,
  toCanonicalAppUserProfile,
} from "./user-profile";

export const AUTH_SESSION_COOKIE_NAME = SESSION_COOKIE_NAME;
export const AUTH_SESSION_MAX_AGE_SECONDS = SESSION_COOKIE_MAX_AGE_SECONDS;

export interface FirebaseIdentity {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  pictureUrl: string | null;
}

export interface AppUserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole | null;
  organizationId: string | null;
  isActive: boolean | null;
}

export interface SafeAuthContext {
  identity: FirebaseIdentity;
  profile: AppUserProfile | null;
}

export interface ServerAuthContext extends SafeAuthContext {
  session: DecodedIdToken;
}

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication is required.");
    this.name = "AuthenticationRequiredError";
  }
}

export async function createFirebaseSessionCookie(idToken: string): Promise<string> {
  return createSessionCookieFromIdToken(idToken);
}

export async function getCurrentAuthenticatedUser(): Promise<ServerAuthContext | null> {
  const authenticatedUser = await getCurrentUser();

  if (!authenticatedUser) {
    return null;
  }

  const storedProfile = await resolveAppUserProfile(authenticatedUser.uid);

  return {
    session: authenticatedUser.token,
    identity: identityFromAuthenticatedUser(authenticatedUser),
    profile: mergeAppUserProfile(authenticatedUser, storedProfile),
  };
}

export async function requireAuthenticatedUser(): Promise<ServerAuthContext> {
  const authContext = await getCurrentAuthenticatedUser();

  if (!authContext) {
    throw new AuthenticationRequiredError();
  }

  return authContext;
}

export async function redirectUnauthenticatedUsers(
  returnToPath?: string,
): Promise<ServerAuthContext> {
  const authContext = await getCurrentAuthenticatedUser();

  if (!authContext) {
    redirect(buildLoginRedirectPath(returnToPath));
  }

  return authContext;
}

export async function getSafeAuthContext(): Promise<SafeAuthContext | null> {
  const authContext = await getCurrentAuthenticatedUser();

  if (!authContext) {
    return null;
  }

  return {
    identity: authContext.identity,
    profile: authContext.profile,
  };
}

export async function resolveAppUserProfile(
  uid: string,
): Promise<AppUserProfile | null> {
  const profile = await getCanonicalUserProfile(uid);
  return toCanonicalAppUserProfile(profile);
}

function identityFromAuthenticatedUser(
  authenticatedUser: AuthenticatedUser,
): FirebaseIdentity {
  return {
    uid: authenticatedUser.uid,
    email: authenticatedUser.email,
    emailVerified: authenticatedUser.emailVerified,
    displayName: authenticatedUser.displayName,
    pictureUrl: authenticatedUser.photoURL,
  };
}

function mergeAppUserProfile(
  authenticatedUser: AuthenticatedUser,
  profile: AppUserProfile | null,
): AppUserProfile {
  return {
    uid: authenticatedUser.uid,
    email: profile?.email ?? authenticatedUser.email,
    displayName: profile?.displayName ?? authenticatedUser.displayName,
    role: profile?.role ?? authenticatedUser.role,
    organizationId: profile?.organizationId ?? authenticatedUser.organizationId,
    isActive: profile?.isActive ?? true,
  };
}
