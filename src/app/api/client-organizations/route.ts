import { NextRequest } from "next/server";
import {
  authorizeClientCreate,
  getBusinessEntityApiContext,
  jsonError,
  jsonOk,
  listClientsForActor,
  parseCreateClientPayload,
  parseEntityListLimit,
  parseJsonObject,
  revalidateClientPaths,
  safeClientSummary,
} from "@/server/api/business-entities";
import { normalizePhaseTwoRouteError } from "@/app/api/_utils/phase-two";

export async function GET(request: NextRequest) {
  try {
    const context = await getBusinessEntityApiContext();
    const clientOrganizations = await listClientsForActor(
      context,
      parseEntityListLimit(request),
    );

    return jsonOk({
      clientOrganizations: clientOrganizations.map(safeClientSummary),
    });
  } catch (error) {
    return jsonError(normalizePhaseTwoRouteError(error));
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getBusinessEntityApiContext();
    authorizeClientCreate(context);

    const input = parseCreateClientPayload(await parseJsonObject(request));
    const result = await context.services.clientLocations.createClient({
      ...context.audit,
      ...input,
    });

    if (!result.ok) {
      throw result.error;
    }

    revalidateClientPaths(result.value.id);

    return jsonOk(
      {
        clientOrganization: {
          ...safeClientSummary(result.value),
          billingEmail: result.value.billingEmail,
          notes: result.value.notes,
          createdAt: result.value.createdAt,
          recordStatus: result.value.recordStatus,
        },
      },
      201,
    );
  } catch (error) {
    return jsonError(normalizePhaseTwoRouteError(error));
  }
}
