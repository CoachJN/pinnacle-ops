import { NextRequest } from "next/server";
import {
  authorizeClientEdit,
  authorizeClientRead,
  getBusinessEntityApiContext,
  jsonError,
  jsonOk,
  parseJsonObject,
  parseUpdateClientPayload,
  revalidateClientPaths,
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

    return jsonOk({
      clientOrganization: await safeClientDetail(context.repositories, result.value),
    });
  } catch (error) {
    return jsonError(normalizePhaseTwoRouteError(error));
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { clientOrganizationId } = await params;
    const context = await getBusinessEntityApiContext();
    const existing =
      await context.services.clientLocations.getClient(clientOrganizationId);

    if (!existing.ok) {
      throw existing.error;
    }

    authorizeClientEdit(context, existing.value);

    const input = parseUpdateClientPayload(await parseJsonObject(request));
    const result = await context.services.clientLocations.updateClient({
      ...context.audit,
      clientOrganizationId,
      ...input,
    });

    if (!result.ok) {
      throw result.error;
    }

    revalidateClientPaths(result.value.id);

    return jsonOk({
      clientOrganization: await safeClientDetail(context.repositories, result.value),
    });
  } catch (error) {
    return jsonError(normalizePhaseTwoRouteError(error));
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { clientOrganizationId } = await params;
    const context = await getBusinessEntityApiContext();
    const existing =
      await context.services.clientLocations.getClient(clientOrganizationId);

    if (!existing.ok) {
      throw existing.error;
    }

    authorizeClientEdit(context, existing.value);

    const result = await context.services.clientLocations.archiveClient({
      ...context.audit,
      clientOrganizationId,
    });

    if (!result.ok) {
      throw result.error;
    }

    revalidateClientPaths(result.value.id);

    return jsonOk({
      clientOrganization: await safeClientDetail(context.repositories, result.value),
    });
  } catch (error) {
    return jsonError(normalizePhaseTwoRouteError(error));
  }
}
