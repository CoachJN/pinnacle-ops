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
  safeLocationDetailForActor,
  safeLocationSummaryForActor,
} from "@/server/api/business-entities";
import {
  resolveContactsById,
  resolveLocationContactLinks,
} from "@/server/api/contact-projections";
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

    return jsonOk({
      locations: locations.map((location) =>
        safeLocationSummaryForActor(context.actor, location),
      ),
    });
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
      ...(context.actor.actorType === "client" ? { notes: undefined } : {}),
    });

    if (!result.ok) {
      throw result.error;
    }

    revalidateLocationPaths(result.value.id);

    const [contactsById, linkedContacts] = await Promise.all([
      resolveContactsById(context.repositories, [
        result.value.primaryContactId,
        result.value.siteContactId,
      ]),
      resolveLocationContactLinks(context.repositories, result.value.id),
    ]);

    return jsonOk(
      {
        location: {
          ...safeLocationDetailForActor(context.actor, result.value),
          primaryContact:
            result.value.primaryContactId == null
              ? null
              : contactsById[result.value.primaryContactId] ?? null,
          siteContact:
            result.value.siteContactId == null
              ? null
              : contactsById[result.value.siteContactId] ?? null,
          linkedContacts,
        },
      },
      201,
    );
  } catch (error) {
    return jsonError(normalizePhaseTwoRouteError(error));
  }
}
