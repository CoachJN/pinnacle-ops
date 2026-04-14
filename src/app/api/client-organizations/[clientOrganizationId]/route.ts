import { NextRequest } from "next/server";
import {
  authorizeClientRead,
  getBusinessEntityApiContext,
  jsonError,
  jsonOk,
  safeClientDetail,
} from "@/server/api/business-entities";
import { normalizePhaseTwoRouteError } from "@/app/api/_utils/phase-two";

interface RouteContext {
  params: Promise<{ clientOrganizationId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { clientOrganizationId } = await params;
    const context = await getBusinessEntityApiContext();
    const result =
      await context.services.clientLocations.getClient(clientOrganizationId);

    if (!result.ok) {
      throw result.error;
    }

    authorizeClientRead(context, result.value);

    return jsonOk({ clientOrganization: safeClientDetail(result.value) });
  } catch (error) {
    return jsonError(normalizePhaseTwoRouteError(error));
  }
}
