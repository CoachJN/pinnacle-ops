import type { ClientOrganization } from "../../types/client.ts";
import type { InternalUserRole } from "../../types/permissions.ts";
import { USER_ROLES } from "../../types/permissions.ts";

export function canViewClients(role: InternalUserRole): boolean {
  return (
    role === USER_ROLES.Coordinator ||
    role === USER_ROLES.Manager ||
    role === USER_ROLES.FinanceAdmin ||
    role === USER_ROLES.Owner
  );
}

export function canViewAllClients(role: InternalUserRole): boolean {
  return canViewClients(role);
}

export function canCreateClient(role: InternalUserRole): boolean {
  return (
    role === USER_ROLES.Coordinator ||
    role === USER_ROLES.Manager ||
    role === USER_ROLES.Owner
  );
}

export function canEditClient(
  role: InternalUserRole,
  client?: ClientOrganization | null,
): boolean {
  void client;
  return canCreateClient(role);
}
