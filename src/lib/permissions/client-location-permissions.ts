import type { InternalUserRole } from "../../types/permissions.ts";
import { canCreateClient, canEditClient, canViewClients } from "./client-permissions.ts";
import {
  canCreateLocation,
  canEditLocation,
  canViewLocations,
} from "./location-permissions.ts";

export function canViewClientLocations(role: InternalUserRole): boolean {
  return canViewClients(role) && canViewLocations(role);
}

export function canCreateClientLocations(role: InternalUserRole): boolean {
  return canCreateClient(role) && canCreateLocation(role);
}

export function canEditClientLocations(role: InternalUserRole): boolean {
  return canEditClient(role) && canEditLocation(role);
}
