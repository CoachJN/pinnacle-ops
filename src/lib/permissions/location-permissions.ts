import type { Location } from "../../types/client.ts";
import type { InternalUserRole } from "../../types/permissions.ts";
import { USER_ROLES } from "../../types/permissions.ts";

export function canViewLocations(role: InternalUserRole): boolean {
  return (
    role === USER_ROLES.Coordinator ||
    role === USER_ROLES.Manager ||
    role === USER_ROLES.FinanceAdmin ||
    role === USER_ROLES.Owner
  );
}

export function canViewAllLocations(role: InternalUserRole): boolean {
  return canViewLocations(role);
}

export function canCreateLocation(role: InternalUserRole): boolean {
  return (
    role === USER_ROLES.Coordinator ||
    role === USER_ROLES.Manager ||
    role === USER_ROLES.Owner
  );
}

export function canEditLocation(
  role: InternalUserRole,
  location?: Location | null,
): boolean {
  void location;
  return canCreateLocation(role);
}
