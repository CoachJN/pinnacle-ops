import "server-only";

import type { Location } from "@/server/repositories";
import type {
  ClientPortalLocationDetail,
  ClientPortalLocationSummary,
} from "@/types/location";

export function toClientPortalLocationSummary(
  location: Location,
): ClientPortalLocationSummary {
  return {
    id: location.id,
    clientOrganizationId: location.clientOrganizationId,
    name: location.name,
    displayName: location.displayName ?? undefined,
    code: location.code ?? undefined,
    storeNumber: location.storeNumber ?? undefined,
    status: location.status,
    city: location.city ?? undefined,
    region: location.region ?? undefined,
    countryCode: location.countryCode ?? undefined,
    timeZone: location.timeZone ?? undefined,
    updatedAt: location.updatedAt,
  };
}

export function toClientPortalLocationDetail(
  location: Location,
): ClientPortalLocationDetail {
  return {
    ...toClientPortalLocationSummary(location),
    addressLine1: location.addressLine1 ?? undefined,
    addressLine2: location.addressLine2 ?? undefined,
    postalCode: location.postalCode ?? undefined,
    primaryContactId: location.primaryContactId ?? undefined,
    siteContactId: location.siteContactId ?? undefined,
    latitude: location.latitude ?? undefined,
    longitude: location.longitude ?? undefined,
    accessNotes: location.accessNotes ?? undefined,
    serviceNotes: location.serviceNotes ?? undefined,
    createdAt: location.createdAt,
  };
}
