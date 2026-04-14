import {
  INTERNAL_USER_ROLES,
  USER_ROLES,
  getRoleDefinition,
  type InternalUserRole,
  type UserRole,
} from "../../types/permissions.ts";

export const INTERNAL_ROLE_OPTIONS = [
  { role: USER_ROLES.Coordinator, label: "Coordinator" },
  { role: USER_ROLES.Manager, label: "Manager" },
  { role: USER_ROLES.FinanceAdmin, label: "Finance/Admin" },
  { role: USER_ROLES.Owner, label: "Owner" },
] as const satisfies readonly {
  readonly role: InternalUserRole;
  readonly label: string;
}[];

export function isInternalUserRole(value: unknown): value is InternalUserRole {
  return (
    typeof value === "string" &&
    (INTERNAL_USER_ROLES as readonly UserRole[]).includes(value as UserRole)
  );
}

export function parseInternalRole(
  value: string | FormDataEntryValue | null | undefined,
): InternalUserRole {
  if (value == null || value === "") {
    return USER_ROLES.Coordinator;
  }

  if (isInternalUserRole(value)) {
    return value;
  }

  throw new Error(`Invalid internal role: ${String(value)}.`);
}

export function getInternalRoleLabel(role: InternalUserRole): string {
  return getRoleDefinition(role).name;
}

export function isOwner(role: InternalUserRole): boolean {
  return role === USER_ROLES.Owner;
}

export function isOperationalRole(role: InternalUserRole): boolean {
  return (
    role === USER_ROLES.Coordinator ||
    role === USER_ROLES.Manager ||
    role === USER_ROLES.Owner
  );
}

export function isFinanceCloseoutRole(role: InternalUserRole): boolean {
  return role === USER_ROLES.FinanceAdmin || role === USER_ROLES.Owner;
}

export function canViewFinanceDashboard(role: InternalUserRole): boolean {
  return (
    role === USER_ROLES.Manager ||
    role === USER_ROLES.FinanceAdmin ||
    role === USER_ROLES.Owner
  );
}
