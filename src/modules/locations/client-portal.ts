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
    code: location.code ?? undefined,
    status: location.status,
    city: location.city ?? undefined,
    region: location.region ?? undefined,
    countryCode: location.countryCode ?? undefined,
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
    locationContactName: location.locationContactName ?? undefined,
    locationContactEmail: location.locationContactEmail ?? undefined,
    locationContactPhone: location.locationContactPhone ?? undefined,
    accessNotes: location.accessNotes ?? undefined,
    createdAt: location.createdAt,
  };
}
