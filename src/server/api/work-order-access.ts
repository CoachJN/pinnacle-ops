import "server-only";

import { createAccessDeniedError } from "@/server/authorization";
import type { AccessActor } from "@/types/auth";
import { USER_ROLES } from "@/types/permissions";

export function authorizeFinanceQueueRead(input: {
  actor: AccessActor;
}): void {
  if (
    input.actor.actorType !== "internal" ||
    (input.actor.role !== USER_ROLES.Manager &&
      input.actor.role !== USER_ROLES.FinanceAdmin &&
      input.actor.role !== USER_ROLES.Owner)
  ) {
    throw createAccessDeniedError();
  }
}

export function listScopeForActor(
  actor: AccessActor,
  limit: number,
) {
  if (actor.actorType === "internal") {
    return {
      scope: "organization" as const,
      organizationId: actor.scope.organizationId,
      limit,
    };
  }

  if (actor.actorType === "client") {
    if (actor.scope.locationAccess.kind === "selected_client_locations") {
      return {
        scope: "locations" as const,
        locationIds: actor.scope.locationAccess.locationIds,
        limit,
      };
    }

    return {
      scope: "clientOrganization" as const,
      clientOrganizationId: actor.scope.clientOrganizationId,
      limit,
    };
  }

  return {
    scope: "contractorOrganization" as const,
    contractorOrganizationId: actor.scope.contractorOrganizationId,
    limit,
  };
}
