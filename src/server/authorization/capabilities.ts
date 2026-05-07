import "server-only";

import {
  AUTHORITY_CATEGORIES,
  PERMISSION_ENTITIES,
  ROLE_PERMISSION_MATRIX,
  USER_ROLES,
  type AuthorityCategory,
  type PermissionEntity,
  type UserRole,
} from "@/types/permissions";
import { APPLICATION_ROLES } from "@/server/authorization/actions";

export interface RoleCapability {
  entity: PermissionEntity;
  action: AuthorityCategory;
}

export type RoleCapabilityMap = Readonly<Record<UserRole, readonly RoleCapability[]>>;

export const ROLE_CAPABILITY_MAP: RoleCapabilityMap = buildRoleCapabilityMap();

export function getRoleCapabilities(role: UserRole): readonly RoleCapability[] {
  return ROLE_CAPABILITY_MAP[role];
}

export function roleHasCapability(
  role: UserRole,
  entity: PermissionEntity,
  action: AuthorityCategory,
): boolean {
  return ROLE_CAPABILITY_MAP[role].some(
    (capability) =>
      capability.entity === entity && capability.action === action,
  );
}

function buildRoleCapabilityMap(): RoleCapabilityMap {
  const capabilities = Object.fromEntries(
    APPLICATION_ROLES.map((role) => [role, [] as RoleCapability[]]),
  ) as Record<UserRole, RoleCapability[]>;
  const permissionEntities = [...new Set(Object.values(PERMISSION_ENTITIES))];

  for (const entity of permissionEntities) {
    for (const action of Object.values(AUTHORITY_CATEGORIES)) {
      const roles = ROLE_PERMISSION_MATRIX[entity][action];

      for (const role of roles) {
        capabilities[role].push({ entity, action });
      }
    }
  }

  return {
    [USER_ROLES.Coordinator]: capabilities[USER_ROLES.Coordinator],
    [USER_ROLES.Manager]: capabilities[USER_ROLES.Manager],
    [USER_ROLES.FinanceAdmin]: capabilities[USER_ROLES.FinanceAdmin],
    [USER_ROLES.Owner]: capabilities[USER_ROLES.Owner],
    [USER_ROLES.ClientUser]: capabilities[USER_ROLES.ClientUser],
    [USER_ROLES.ContractorUser]: capabilities[USER_ROLES.ContractorUser],
  };
}
