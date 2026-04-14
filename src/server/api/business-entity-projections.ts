import "server-only";

import type { Location } from "@/server/repositories";
import type { AccessActor } from "@/types/auth";

export function safeLocationSummary(location: Location) {
  return {
    id: location.id,
    clientOrganizationId: location.clientOrganizationId,
    clientSnapshot: location.clientSnapshot,
    name: location.name,
    code: location.code,
    status: location.status,
    city: location.city,
    region: location.region,
    countryCode: location.countryCode,
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

  return {
    ...summary,
    clientSnapshot: undefined,
  };
}

export function safeLocationDetail(location: Location) {
  return {
    ...safeLocationSummary(location),
    addressLine1: location.addressLine1,
    addressLine2: location.addressLine2,
    postalCode: location.postalCode,
    locationContactName: location.locationContactName,
    locationContactEmail: location.locationContactEmail,
    locationContactPhone: location.locationContactPhone,
    accessNotes: location.accessNotes,
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
    clientSnapshot: undefined,
    notes: undefined,
    recordStatus: undefined,
  };
}
