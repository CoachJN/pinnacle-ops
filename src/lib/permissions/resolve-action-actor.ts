import { getCurrentAuthenticatedUser } from "@/server/auth";
import { getMockCurrentUser } from "@/lib/permissions/mock-current-user";
import {
  getInternalRoleLabel,
  isInternalUserRole,
  parseInternalRole,
} from "./roles";
import type { MockCurrentUser } from "./mock-current-user";

export async function resolveActionActor(
  formRoleInput: string | null = null,
): Promise<MockCurrentUser | null> {
  const auth = await getCurrentAuthenticatedUser();

  if (auth?.profile?.role) {
    if (isInternalUserRole(auth.profile.role)) {
      return {
        id: auth.session.uid,
        name:
          auth.profile.displayName ??
          auth.identity.displayName ??
          auth.identity.email ??
          "Authenticated user",
        role: auth.profile.role,
        roleLabel: getInternalRoleLabel(auth.profile.role),
      };
    }

    return null;
  }

  if (formRoleInput == null || formRoleInput.trim() === "") {
    return getMockCurrentUser();
  }

  return getMockCurrentUser(parseInternalRole(formRoleInput));
}

export function unauthorizedActionMessage(): string {
  return "You are not authorized to perform this action.";
}
