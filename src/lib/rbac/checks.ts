import {
  APP_ROLES,
  APP_ROLE_VALUES,
  type AppRole,
} from "@/lib/rbac/roles";
import type {
  RoleSubject,
  UserWithAllowedRole,
} from "@/lib/auth/auth-types";
import {
  APP_PERMISSIONS,
  ROLE_PERMISSIONS,
  getPermissionForAction,
  type AppAction,
  type AppPermission,
} from "@/lib/rbac/permissions";
import {
  AuthenticationError,
  AuthorizationError,
} from "@/lib/utils/errors";
import type { NavigationItem } from "@/types/navigation";

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && APP_ROLE_VALUES.includes(value as AppRole);
}

const APP_ROLE_ALIASES: Readonly<Record<string, AppRole>> = {
  COORDINATOR: APP_ROLES.Coordinator,
  MANAGER: APP_ROLES.Manager,
  FINANCE_ADMIN: APP_ROLES.FinanceAdmin,
  OWNER: APP_ROLES.Owner,
  CLIENT_USER: APP_ROLES.ClientUser,
  CONTRACTOR_USER: APP_ROLES.ContractorUser,
  "Finance/Admin": APP_ROLES.FinanceAdmin,
  "Client User": APP_ROLES.ClientUser,
  "Contractor User": APP_ROLES.ContractorUser,
};

function normalizeAppRole(value: unknown): AppRole | null {
  if (isAppRole(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  const aliasKey = normalizedValue
    .replace(/[ /-]+/g, "_")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toUpperCase();

  return APP_ROLE_ALIASES[aliasKey] ?? APP_ROLE_ALIASES[normalizedValue] ?? null;
}

export function assertAppRole(value: unknown): AppRole {
  const normalizedRole = normalizeAppRole(value);

  if (!normalizedRole) {
    throw new Error("Invalid application role.");
  }

  return normalizedRole;
}

export function hasAnyRole(
  userRole: AppRole,
  allowedRoles: readonly AppRole[],
): boolean {
  return allowedRoles.includes(userRole);
}

export function hasRole<
  TUser extends RoleSubject,
  TAllowedRoles extends readonly AppRole[],
>(
  user: TUser | null | undefined,
  allowedRoles: TAllowedRoles,
): user is UserWithAllowedRole<TUser, TAllowedRoles> {
  return user != null && hasAnyRole(user.role, allowedRoles);
}

export function requireRole<
  TUser extends RoleSubject,
  TAllowedRoles extends readonly AppRole[],
>(
  user: TUser | null | undefined,
  allowedRoles: TAllowedRoles,
  message?: string,
): UserWithAllowedRole<TUser, TAllowedRoles> {
  if (!user) {
    throw new AuthenticationError();
  }

  if (!hasRole(user, allowedRoles)) {
    throw new AuthorizationError(message);
  }

  return user;
}

export function hasPermission(
  subject: RoleSubject | AppRole | null | undefined,
  permission: AppPermission,
): boolean {
  const role = resolveAppRole(subject);

  if (!role) {
    return false;
  }

  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canAccessAppShell(
  user: RoleSubject | null | undefined,
): boolean {
  return hasPermission(user, APP_PERMISSIONS.AccessApp);
}

export function requireAppShellAccess<TUser extends RoleSubject>(
  user: TUser | null | undefined,
  message = "You do not have access to the application shell.",
): TUser {
  if (!user) {
    throw new AuthenticationError();
  }

  if (!canAccessAppShell(user)) {
    throw new AuthorizationError(message);
  }

  return user;
}

export function canAccessDashboard(
  user: RoleSubject | null | undefined,
): boolean {
  return canAccessAppShell(user);
}

export function requireDashboardAccess<TUser extends RoleSubject>(
  user: TUser | null | undefined,
  message = "You do not have access to the dashboard.",
): TUser {
  if (!user) {
    throw new AuthenticationError();
  }

  if (!canAccessDashboard(user)) {
    throw new AuthorizationError(message);
  }

  return user;
}

export function hasActionPermission(
  subject: RoleSubject | AppRole | null | undefined,
  action: AppAction,
): boolean {
  const permission = getPermissionForAction(action);

  return permission ? hasPermission(subject, permission) : false;
}

export function canAccessNavigationItem(
  subject: RoleSubject | AppRole | null | undefined,
  item: Pick<NavigationItem, "allowedRoles">,
): boolean {
  const role = resolveAppRole(subject);

  return role ? hasAnyRole(role, item.allowedRoles) : false;
}

export function getNavigationItemsForRole(
  subject: RoleSubject | AppRole | null | undefined,
  items: readonly NavigationItem[],
): NavigationItem[] {
  return items.filter((item) => canAccessNavigationItem(subject, item));
}

function resolveAppRole(
  subject: RoleSubject | AppRole | null | undefined,
): AppRole | null {
  if (!subject) {
    return null;
  }

  if (typeof subject === "string") {
    return isAppRole(subject) ? subject : null;
  }

  return subject.role;
}
