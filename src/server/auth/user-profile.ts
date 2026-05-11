import "server-only";

import {
  createFirestoreRepositories,
  type UserProfile,
} from "@/server/repositories";
import type { AppRole } from "@/lib/auth/auth-types";
import type { UserRole } from "@/types/permissions";

export interface CanonicalAppUserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole | null;
  organizationId: string | null;
  isActive: boolean;
}

export interface CanonicalSessionProfile {
  role: AppRole | null;
  organizationId: string | undefined;
}

export async function getCanonicalUserProfile(
  uid: string,
): Promise<UserProfile | null> {
  return createFirestoreRepositories().userProfiles.getById(uid);
}

export function toCanonicalAppUserProfile(
  profile: UserProfile | null,
): CanonicalAppUserProfile | null {
  if (!profile) {
    return null;
  }

  return {
    uid: profile.id,
    email: profile.email,
    displayName: profile.displayName,
    role: profile.role,
    organizationId: profile.organizationId,
    isActive: profile.status === "active",
  };
}

export function toCanonicalSessionProfile(
  profile: UserProfile | null,
): CanonicalSessionProfile | null {
  if (!profile) {
    return null;
  }

  return {
    role: profile.role,
    organizationId: profile.organizationId ?? undefined,
  };
}
