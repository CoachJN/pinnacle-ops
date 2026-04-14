import { NextRequest } from "next/server";
import {
  getBusinessEntityApiContext,
  jsonError,
  jsonOk,
  listClientsForActor,
  parseEntityListLimit,
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
