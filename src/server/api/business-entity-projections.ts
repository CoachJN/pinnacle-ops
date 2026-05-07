import "server-only";

import type { Location } from "@/server/repositories";
import type { AccessActor } from "@/types/auth";

export function safeLocationSummary(location: Location) {
  return {
    id: location.id,
    clientOrganizationId: location.clientOrganizationId,
    name: location.name,
    displayName: location.displayName,
    code: location.code,
    storeNumber: location.storeNumber,
    status: location.status,
    city: location.city,
    region: location.region,
    countryCode: location.countryCode,
    timeZone: location.timeZone,
    updatedAt: location.updatedAt,
  };
}

export function safeLocationSummaryForActor(
  actor: AccessActor,
  location: Location,
) {
  const summary = safeLocationSummary(location);

  if (actor.actorType !== "client") {
    return summary;
  }

  return summary;
}

export function safeLocationDetail(location: Location) {
  return {
    ...safeLocationSummary(location),
    addressLine1: location.addressLine1,
    addressLine2: location.addressLine2,
    postalCode: location.postalCode,
    primaryContactId: location.primaryContactId,
    siteContactId: location.siteContactId,
    latitude: location.latitude,
    longitude: location.longitude,
    accessNotes: location.accessNotes,
    serviceNotes: location.serviceNotes,
    notes: location.notes,
    createdAt: location.createdAt,
    recordStatus: location.recordStatus,
  };
}

export function safeLocationDetailForActor(
  actor: AccessActor,
  location: Location,
) {
  const detail = safeLocationDetail(location);

  if (actor.actorType !== "client") {
    return detail;
  }

  return {
    ...detail,
    notes: undefined,
    recordStatus: undefined,
  };
}
