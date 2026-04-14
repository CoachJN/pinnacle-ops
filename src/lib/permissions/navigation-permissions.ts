import type { InternalUserRole } from "../../types/permissions.ts";
import { USER_ROLES } from "../../types/permissions.ts";
import { canViewClients } from "./client-permissions.ts";
import { canViewContractorModule } from "./contractor-permissions.ts";
import { canViewLocations } from "./location-permissions.ts";
import { canViewWorkOrders } from "./work-order-permissions.ts";

export interface NavigationItem {
  label: string;
  href: string;
}

export function getVisibleNavigationForRole(
  role: InternalUserRole,
): NavigationItem[] {
  const items: NavigationItem[] = [
    { label: "Dashboard", href: `/dashboard?role=${role}` },
  ];

  if (canViewWorkOrders(role)) {
    items.push({ label: "Work Orders", href: `/work-orders?role=${role}` });
  }

  if (canViewClients(role)) {
    items.push({ label: "Clients", href: `/clients?role=${role}` });
  }

  if (canViewLocations(role)) {
    items.push({ label: "Locations", href: `/locations?role=${role}` });
  }

  if (canViewContractorModule(role)) {
    items.push({ label: "Contractors", href: `/contractors?role=${role}` });
  }

  if (role === USER_ROLES.FinanceAdmin || role === USER_ROLES.Owner) {
    items.push({ label: "Finance", href: `/finance?role=${role}` });
  }

  if (role === USER_ROLES.Owner) {
    items.push({ label: "Settings", href: `/settings?role=${role}` });
  }

  return items;
}
