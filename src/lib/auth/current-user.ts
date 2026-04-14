import "server-only";

import type {
  AuthenticatedUser,
  AuthSession,
  SessionUser,
} from "@/lib/auth/auth-types";
import { APP_ROLE_LABELS } from "@/lib/rbac/roles";
import {
  getOptionalSession,
} from "@/lib/auth/session";
import { AuthenticationError } from "@/lib/utils/errors";
import type { NormalizedCurrentUser } from "@/types/auth";

export async function getOptionalUser(): Promise<AuthenticatedUser | null> {
  const session = await getOptionalSession();

  if (!session) {
    return null;
  }

  return normalizeAuthenticatedUser(session.user, session.token);
}

export const getCurrentUser = getOptionalUser;

export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getOptionalUser();

  if (!user) {
    throw new AuthenticationError();
  }

  return user;
}

export const requireCurrentUser = requireUser;

function normalizeAuthenticatedUser(
  sessionUser: SessionUser,
  token: AuthSession["token"],
): AuthenticatedUser {
  return {
    ...sessionUser,
    email: sessionUser.email ?? null,
    displayName: sessionUser.displayName ?? null,
    photoURL: sessionUser.photoURL ?? null,
    organizationId: sessionUser.organizationId ?? null,
    token,
  };
}

export function getCurrentUserDisplayName(
  user: Pick<AuthenticatedUser, "displayName" | "email">,
): string {
  const normalizedDisplayName = user.displayName?.trim();

  if (normalizedDisplayName) {
    return normalizedDisplayName;
  }

  const normalizedEmail = user.email?.trim();

  if (normalizedEmail) {
    return normalizedEmail;
  }

  return "Authenticated user";
}

export function normalizeCurrentUser(
  user: AuthenticatedUser,
): NormalizedCurrentUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    displayLabel: getCurrentUserDisplayName(user),
    role: user.role,
    roleLabel: APP_ROLE_LABELS[user.role],
    organizationId: user.organizationId,
    emailVerified: user.emailVerified,
  };
}
