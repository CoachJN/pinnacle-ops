import type { NavigationItem } from "@/types/navigation";
import {
  APP_ROLE_VALUES,
  APP_ROLES,
  INTERNAL_APP_ROLES,
  type AppRole,
} from "@/lib/rbac/roles";
import { APP_PATHS } from "@/lib/utils/constants";

const ALL_APP_ROLES: readonly AppRole[] = APP_ROLE_VALUES;

const WORK_ORDER_NAV_ROLES: readonly AppRole[] = [...ALL_APP_ROLES] as const;

const FINANCE_NAV_ROLES: readonly AppRole[] = [
  APP_ROLES.FinanceAdmin,
  APP_ROLES.Owner,
] as const;

const SETTINGS_NAV_ROLES: readonly AppRole[] = [APP_ROLES.Owner] as const;

export const APP_PRIMARY_NAV_ITEMS: readonly NavigationItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: APP_PATHS.dashboard,
    allowedRoles: ALL_APP_ROLES,
    match: "exact",
  },
  {
    id: "work-orders",
    label: "Work Orders",
    href: APP_PATHS.workOrders,
    allowedRoles: WORK_ORDER_NAV_ROLES,
    match: "prefix",
  },
  {
    id: "clients",
    label: "Clients",
    href: APP_PATHS.clientOrganizations,
    allowedRoles: INTERNAL_APP_ROLES,
    match: "prefix",
  },
  {
    id: "locations",
    label: "Locations",
    href: APP_PATHS.locations,
    allowedRoles: INTERNAL_APP_ROLES,
    match: "prefix",
  },
  {
    id: "contractors",
    label: "Contractors",
    href: APP_PATHS.contractors,
    allowedRoles: INTERNAL_APP_ROLES,
    match: "prefix",
  },
  {
    id: "finance",
    label: "Finance",
    href: APP_PATHS.finance,
    allowedRoles: FINANCE_NAV_ROLES,
    match: "prefix",
  },
  {
    id: "settings",
    label: "Settings",
    href: APP_PATHS.settings,
    allowedRoles: SETTINGS_NAV_ROLES,
    match: "prefix",
    disabled: true,
  },
] as const;
