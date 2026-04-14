import type { NavigationItem } from "@/types/navigation";
import {
  APP_ROLE_VALUES,
  APP_ROLES,
  type AppRole,
} from "@/lib/rbac/roles";
import { APP_PATHS } from "@/lib/utils/constants";

const ALL_APP_ROLES: readonly AppRole[] = APP_ROLE_VALUES;

const WORK_ORDER_NAV_ROLES: readonly AppRole[] = [...ALL_APP_ROLES] as const;

const FINANCE_NAV_ROLES: readonly AppRole[] = [
  APP_ROLES.FinanceAdmin,
  APP_ROLES.Owner,
] as const;

export const APP_PRIMARY_NAV_ITEMS: readonly NavigationItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: APP_PATHS.dashboard,
    allowedRoles: ALL_APP_ROLES,
    match: "exact",
  },
  {
    id: "locations",
    label: "Locations",
    href: APP_PATHS.locations,
    allowedRoles: WORK_ORDER_NAV_ROLES,
    match: "prefix",
  },
  {
    id: "contractors",
    label: "Contractors",
    href: APP_PATHS.contractors,
    allowedRoles: WORK_ORDER_NAV_ROLES,
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
    id: "client-portal",
    label: "Client Portal",
    href: "/portal",
    allowedRoles: ALL_APP_ROLES,
    match: "prefix",
  },
  {
    id: "contractor-portal",
    label: "Contractor Portal",
    href: "/contractor/dashboard",
    allowedRoles: ALL_APP_ROLES,
    match: "prefix",
  },
] as const;
