import { NextRequest } from "next/server";
import {
  authorizeLocationArchive,
  authorizeLocationEdit,
  authorizeLocationRead,
  getBusinessEntityApiContext,
  jsonError,
  jsonOk,
  parseJsonObject,
  parseUpdateLocationPayload,
  revalidateLocationPaths,
  safeLocationDetailForActor,
} from "@/server/api/business-entities";
import { normalizePhaseTwoRouteError } from "@/app/api/_utils/phase-two";

interface RouteContext {
  params: Promise<{ locationId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { locationId } = await params;
    const context = await getBusinessEntityApiContext();
    const result = await context.services.clientLocations.getLocation(locationId);

    if (!result.ok) {
      throw result.error;
    }

    authorizeLocationRead(context, result.value);

    return jsonOk({
      location: safeLocationDetailForActor(context.actor, result.value),
    });
  } catch (error) {
    return jsonError(normalizePhaseTwoRouteError(error));
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { locationId } = await params;
    const context = await getBusinessEntityApiContext();
    const existing = await context.services.clientLocations.getLocation(locationId);

    if (!existing.ok) {
      throw existing.error;
    }

    authorizeLocationEdit(context, existing.value);

    const input = parseUpdateLocationPayload(await parseJsonObject(request));
    const result = await context.services.clientLocations.updateLocation({
      ...context.audit,
      locationId,
      ...input,
      ...(context.actor.actorType === "client"
        ? { clientOrganizationId: undefined, notes: undefined }
        : {}),
    });

    if (!result.ok) {
      throw result.error;
    }

    revalidateLocationPaths(result.value.id);

    return jsonOk({
      location: safeLocationDetailForActor(context.actor, result.value),
    });
  } catch (error) {
    return jsonError(normalizePhaseTwoRouteError(error));
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { locationId } = await params;
    const context = await getBusinessEntityApiContext();
    const existing = await context.services.clientLocations.getLocation(locationId);

    if (!existing.ok) {
      throw existing.error;
    }

    authorizeLocationArchive(context, existing.value);

    const result = await context.services.clientLocations.updateLocation({
      ...context.audit,
      locationId,
      status: "inactive",
    });

    if (!result.ok) {
      throw result.error;
    }

    revalidateLocationPaths(result.value.id);

    return jsonOk({
      location: safeLocationDetailForActor(context.actor, result.value),
    });
  } catch (error) {
    return jsonError(normalizePhaseTwoRouteError(error));
  }
}
