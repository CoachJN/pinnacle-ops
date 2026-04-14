import type { InternalUserRole } from "@/types/permissions";
import { USER_ROLES } from "@/types/permissions";
import { getInternalRoleLabel, parseInternalRole } from "./roles";

export interface MockCurrentUser {
  id: string;
  name: string;
  role: InternalUserRole;
  roleLabel: string;
}

const userByRole = {
  [USER_ROLES.Coordinator]: {
    id: "usr-coordinator",
    name: "Casey Coordinator",
  },
  [USER_ROLES.Manager]: {
    id: "usr-manager",
    name: "Morgan Manager",
  },
  [USER_ROLES.FinanceAdmin]: {
    id: "usr-finance",
    name: "Finley Finance",
  },
  [USER_ROLES.Owner]: {
    id: "usr-owner",
    name: "Orion Owner",
  },
} as const satisfies Record<
  InternalUserRole,
  {
    readonly id: string;
    readonly name: string;
  }
>;

export function getMockCurrentUser(roleInput?: string | null): MockCurrentUser {
  const role = parseInternalRole(roleInput);
  const identity = userByRole[role];

  return {
    ...identity,
    role,
    roleLabel: getInternalRoleLabel(role),
  };
}
