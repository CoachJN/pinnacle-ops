import type { NavigationItem } from "@/types/navigation";
import {
  APP_ROLE_VALUES,
  INTERNAL_APP_ROLES,
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

const CLIENT_PORTAL_NAV_ROLES: readonly AppRole[] = [
  APP_ROLES.ClientUser,
] as const;

const CONTRACTOR_PORTAL_NAV_ROLES: readonly AppRole[] = [
  APP_ROLES.ContractorUser,
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
    id: "work-orders",
    label: "Work Orders",
    href: APP_PATHS.workOrders,
    allowedRoles: WORK_ORDER_NAV_ROLES,
    match: "prefix",
  },
  {
    id: "intake",
    label: "Intake",
    href: APP_PATHS.intakeReview,
    allowedRoles: INTERNAL_APP_ROLES,
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
    id: "client-organizations",
    label: "Clients",
    href: APP_PATHS.clientOrganizations,
    allowedRoles: WORK_ORDER_NAV_ROLES,
    match: "prefix",
  },
  {
    id: "locations",
    label: "Locations",
    href: APP_PATHS.locations,
    allowedRoles: WORK_ORDER_NAV_ROLES,
    match: "prefix",
  },
  {
    id: "contacts",
    label: "Contacts",
    href: APP_PATHS.contacts,
    allowedRoles: INTERNAL_APP_ROLES,
    match: "prefix",
  },
  {
    id: "client-portal",
    label: "Client Portal",
    href: APP_PATHS.clientPortal,
    allowedRoles: CLIENT_PORTAL_NAV_ROLES,
    match: "prefix",
  },
  {
    id: "contractor-portal",
    label: "Contractor Portal",
    href: APP_PATHS.contractorPortal,
    allowedRoles: CONTRACTOR_PORTAL_NAV_ROLES,
    match: "prefix",
  },
  {
    id: "finance",
    label: "Finance",
    href: APP_PATHS.finance,
    allowedRoles: FINANCE_NAV_ROLES,
    match: "prefix",
  },
] as const;
