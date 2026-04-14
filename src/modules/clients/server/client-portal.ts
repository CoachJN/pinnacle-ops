import "server-only";

import { createAccessDeniedError } from "@/server/authorization";
import { getWorkOrderApiContext } from "@/server/api/work-orders";
import { createGetWorkOrderDetailService } from "@/lib/services/work-orders";
import { toClientPortalLocationDetail, toClientPortalLocationSummary } from "@/modules/locations/client-portal";
import { toClientPortalQuoteDetail } from "@/modules/quotes/client-portal";
import {
  toClientPortalWorkOrderDetail,
  toClientPortalWorkOrderSummary,
} from "@/modules/work-orders/client-portal";
import type { ClientAccessActor } from "@/types/auth";
import type { ClientPortalLandingSummary } from "@/types/client";
import type {
  ClientPortalLocationDetail,
  ClientPortalLocationSummary,
} from "@/types/location";
import type { ClientPortalQuoteDetail } from "@/types/quote";
import type {
  ClientPortalWorkOrderDetail,
  ClientPortalWorkOrderSummary,
  WorkOrderStatus,
} from "@/types/work-order";

interface ClientPortalLocationFilters {
  search?: string;
  status?: "active" | "inactive";
}

interface ClientPortalWorkOrderFilters {
  search?: string;
  status?: WorkOrderStatus;
  locationId?: string;
}

export async function getClientPortalLandingSummary(): Promise<ClientPortalLandingSummary> {
  const context = await requireClientPortalContext();
  const [client, locations, workOrders] = await Promise.all([
    context.services.clientLocations.getClient(context.actor.scope.clientOrganizationId),
    listClientPortalLocations(),
    listClientPortalWorkOrders(),
  ]);

  if (!client.ok) {
    throw client.error;
  }

  return {
    organizationId: client.value.id,
    organizationName: client.value.displayName ?? client.value.name,
    locationCount: locations.length,
    activeWorkOrderCount: workOrders.filter((workOrder) =>
      workOrder.status !== "closed" && workOrder.status !== "cancelled"
    ).length,
    quotesAwaitingResponseCount: workOrders.filter(
      (workOrder) => workOrder.currentQuoteStatus === "sent",
    ).length,
  };
}

export async function listClientPortalLocations(
  filters: ClientPortalLocationFilters = {},
): Promise<ClientPortalLocationSummary[]> {
  const context = await requireClientPortalContext();
  const result =
    context.actor.scope.locationAccess.kind === "selected_client_locations"
      ? await context.services.clientLocations.listLocations({
          scope: "ids",
          locationIds: context.actor.scope.locationAccess.locationIds,
          limit: 100,
        })
      : await context.services.clientLocations.listLocations({
          scope: "clientOrganization",
          clientOrganizationId: context.actor.scope.clientOrganizationId,
          limit: 100,
        });

  if (!result.ok) {
    throw result.error;
  }

  const normalizedSearch = filters.search?.trim().toLowerCase();

  return result.value
    .filter((location) => {
      if (filters.status && location.status !== filters.status) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [location.name, location.code, location.city]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    })
    .map(toClientPortalLocationSummary)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function getClientPortalLocation(
  locationId: string,
): Promise<ClientPortalLocationDetail> {
  const context = await requireClientPortalContext();
  const result = await context.services.clientLocations.getLocation(locationId);

  if (!result.ok) {
    throw result.error;
  }

  assertClientLocationScope(context.actor, result.value.clientOrganizationId, result.value.id);

  return toClientPortalLocationDetail(result.value);
}

export async function listClientPortalWorkOrders(
  filters: ClientPortalWorkOrderFilters = {},
): Promise<ClientPortalWorkOrderSummary[]> {
  const context = await requireClientPortalContext();
  if (filters.locationId && !isLocationVisibleToClient(context.actor, filters.locationId)) {
    throw createAccessDeniedError("You do not have access to that location.");
  }
  const scopedLocationId =
    filters.locationId ?? undefined;
  const result = scopedLocationId
    ? await context.repositories.workOrders.listByLocationId(scopedLocationId, {
        limit: 100,
      })
    : await context.repositories.workOrders.listByClientOrganizationId(
        context.actor.scope.clientOrganizationId,
        { limit: 100 },
      );

  const normalizedSearch = filters.search?.trim().toLowerCase();
  const visibleItems = result.items.filter((workOrder) => {
    if (!isLocationVisibleToClient(context.actor, workOrder.locationId)) {
      return false;
    }

    if (filters.status && workOrder.status !== filters.status) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return [
      workOrder.workOrderNumber,
      workOrder.title,
      workOrder.locationSnapshot.name,
    ]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(normalizedSearch));
  });

  const currentQuotes = await Promise.all(
    visibleItems.map(async (workOrder) => {
      if (!workOrder.currentQuoteId) {
        return null;
      }

      const quote = await context.repositories.clientQuotes.getById(workOrder.currentQuoteId);
      return quote && !quote.isDeleted ? quote : null;
    }),
  );

  return visibleItems.map((workOrder, index) =>
    toClientPortalWorkOrderSummary(workOrder, currentQuotes[index] ?? null),
  );
}

export async function getClientPortalWorkOrder(
  workOrderId: string,
): Promise<ClientPortalWorkOrderDetail> {
  const context = await requireClientPortalContext();
  const [legacyWorkOrder, detailResult] = await Promise.all([
    context.services.workOrders.getById(workOrderId),
    createGetWorkOrderDetailService().getWorkOrderDetail({ workOrderId }),
  ]);

  if (!legacyWorkOrder.ok) {
    throw legacyWorkOrder.error;
  }

  if (!detailResult.ok) {
    throw detailResult.error;
  }

  assertClientLocationScope(
    context.actor,
    legacyWorkOrder.value.clientOrganizationId,
    legacyWorkOrder.value.locationId,
  );

  const currentQuote = legacyWorkOrder.value.currentQuoteId
    ? await context.repositories.clientQuotes.getById(legacyWorkOrder.value.currentQuoteId)
    : null;

  return toClientPortalWorkOrderDetail(
    detailResult.value,
    legacyWorkOrder.value,
    currentQuote && !currentQuote.isDeleted ? currentQuote : null,
  );
}

export async function getClientPortalQuote(
  quoteId: string,
): Promise<ClientPortalQuoteDetail> {
  const context = await requireClientPortalContext();
  const quote = await context.repositories.clientQuotes.getById(quoteId);

  if (!quote || quote.isDeleted) {
    throw createAccessDeniedError("Quote could not be found.");
  }

  assertClientLocationScope(context.actor, quote.clientOrganizationId, quote.locationId);

  return toClientPortalQuoteDetail(quote);
}

export async function requireClientPortalContext() {
  const context = await getWorkOrderApiContext();

  if (context.actor.actorType !== "client") {
    throw createAccessDeniedError("Client portal access is restricted to client users.");
  }

  return {
    ...context,
    actor: context.actor,
  } as typeof context & { actor: ClientAccessActor };
}

function assertClientLocationScope(
  actor: ClientAccessActor,
  clientOrganizationId: string,
  locationId: string,
): void {
  if (actor.scope.clientOrganizationId !== clientOrganizationId) {
    throw createAccessDeniedError("You do not have access to this client organization.");
  }

  if (!isLocationVisibleToClient(actor, locationId)) {
    throw createAccessDeniedError("You do not have access to this location.");
  }
}

function isLocationVisibleToClient(
  actor: ClientAccessActor,
  locationId: string,
): boolean {
  return (
    actor.scope.locationAccess.kind === "all_client_locations" ||
    actor.scope.locationAccess.locationIds.includes(locationId)
  );
}
