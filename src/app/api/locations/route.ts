import { NextRequest } from "next/server";
import {
  authorizeLocationCreate,
  getBusinessEntityApiContext,
  jsonError,
  jsonOk,
  listLocationsForActor,
  parseCreateLocationPayload,
  parseJsonObject,
  revalidateLocationPaths,
  safeLocationDetail,
  safeLocationSummary,
} from "@/server/api/business-entities";
import {
  filterLocations,
  normalizePhaseTwoRouteError,
  parseLocationListFilters,
} from "@/app/api/_utils/phase-two";

export async function GET(request: NextRequest) {
  try {
    const context = await getBusinessEntityApiContext();
    const filters = parseLocationListFilters(request, context.actor);
    const locations = filterLocations(
      await listLocationsForActor(context, filters.limit),
      {
        clientOrganizationId: filters.clientOrganizationId,
        isActive: filters.isActive,
        search: filters.search,
      },
    );

    return jsonOk({ locations: locations.map(safeLocationSummary) });
  } catch (error) {
    return jsonError(normalizePhaseTwoRouteError(error));
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getBusinessEntityApiContext();
    const input = parseCreateLocationPayload(await parseJsonObject(request));

    authorizeLocationCreate(context, input.clientOrganizationId);

    const result = await context.services.clientLocations.createLocation({
      ...context.audit,
      ...input,
    });

    if (!result.ok) {
      throw result.error;
    }

    revalidateLocationPaths(result.value.id);

    return jsonOk({ location: safeLocationDetail(result.value) }, 201);
  } catch (error) {
    return jsonError(normalizePhaseTwoRouteError(error));
  }
}
