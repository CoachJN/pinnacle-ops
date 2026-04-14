import "server-only";

import { redirect } from "next/navigation";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { DocumentData } from "firebase-admin/firestore";
import type { AuthenticatedUser } from "@/lib/auth/auth-types";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createSessionCookieFromIdToken } from "@/lib/auth/session";
import {
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
} from "@/lib/utils/constants";
import { getFirebaseAdminFirestore } from "@/server/firebase";
import { buildLoginRedirectPath } from "./redirect-path";
import { USER_ROLES, type UserRole } from "@/types/permissions";

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
  const snapshot = await getFirebaseAdminFirestore()
    .collection("users")
    .doc(uid)
    .get();

  if (!snapshot.exists) {
    return null;
  }

  return normalizeAppUserProfile(uid, snapshot.data());
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

function normalizeAppUserProfile(
  uid: string,
  data: DocumentData | undefined,
): AppUserProfile {
  return {
    uid,
    email: readString(data?.email),
    displayName: readString(data?.displayName) ?? readString(data?.name),
    role: readUserRole(data?.roleCode ?? data?.role),
    organizationId: readString(data?.organizationId),
    isActive: readBoolean(data?.isActive),
  };
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function readUserRole(value: unknown): UserRole | null {
  if (
    typeof value === "string" &&
    Object.values(USER_ROLES).includes(value as UserRole)
  ) {
    return value as UserRole;
  }

  return null;
}
