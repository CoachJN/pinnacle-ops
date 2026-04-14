import { APP_ROLE_VALUES, type AppRole } from "@/lib/rbac/roles";

export const APP_PERMISSIONS = {
  AccessApp: "app.access",
  ViewDashboard: "dashboard.view",
  ManageSession: "session.manage",
} as const;

export type AppPermission =
  (typeof APP_PERMISSIONS)[keyof typeof APP_PERMISSIONS];

export const APP_ACTIONS = {
  Access: "access",
  View: "view",
  Manage: "manage",
} as const;

export type AppAction = (typeof APP_ACTIONS)[keyof typeof APP_ACTIONS];

const FOUNDATION_PERMISSIONS = [
  APP_PERMISSIONS.AccessApp,
  APP_PERMISSIONS.ViewDashboard,
  APP_PERMISSIONS.ManageSession,
] as const satisfies readonly AppPermission[];

export const ROLE_PERMISSIONS: Record<AppRole, readonly AppPermission[]> =
  APP_ROLE_VALUES.reduce<Record<AppRole, readonly AppPermission[]>>(
    (accumulator, role) => {
      accumulator[role] = FOUNDATION_PERMISSIONS;
      return accumulator;
    },
    {} as Record<AppRole, readonly AppPermission[]>,
  );

export const ACTION_PERMISSION_PLACEHOLDERS: Partial<
  Record<AppAction, AppPermission>
> = {
  [APP_ACTIONS.Access]: APP_PERMISSIONS.AccessApp,
  [APP_ACTIONS.View]: APP_PERMISSIONS.ViewDashboard,
  [APP_ACTIONS.Manage]: APP_PERMISSIONS.ManageSession,
};

export function getPermissionForAction(
  action: AppAction,
): AppPermission | null {
  return ACTION_PERMISSION_PLACEHOLDERS[action] ?? null;
}
