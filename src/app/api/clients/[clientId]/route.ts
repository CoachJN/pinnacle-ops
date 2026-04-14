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

interface RouteContext {
  params: Promise<{ clientId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { clientId } = await params;
    const context = await getBusinessEntityApiContext();
    const result = await context.services.clientLocations.getClient(clientId);

    if (!result.ok) {
      throw result.error;
    }

    authorizeClientRead(context, result.value);

    return jsonOk({ client: safeClientDetail(result.value) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { clientId } = await params;
    const context = await getBusinessEntityApiContext();
    const existing = await context.services.clientLocations.getClient(clientId);

    if (!existing.ok) {
      throw existing.error;
    }

    authorizeClientEdit(context, existing.value);

    const input = parseUpdateClientPayload(await parseJsonObject(request));
    const result = await context.services.clientLocations.updateClient({
      ...context.audit,
      clientOrganizationId: clientId,
      ...input,
    });

    if (!result.ok) {
      throw result.error;
    }

    revalidateClientPaths(result.value.id);

    return jsonOk({ client: safeClientDetail(result.value) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { clientId } = await params;
    const context = await getBusinessEntityApiContext();
    const existing = await context.services.clientLocations.getClient(clientId);

    if (!existing.ok) {
      throw existing.error;
    }

    authorizeClientEdit(context, existing.value);

    const result = await context.services.clientLocations.archiveClient({
      ...context.audit,
      clientOrganizationId: clientId,
    });

    if (!result.ok) {
      throw result.error;
    }

    revalidateClientPaths(result.value.id);

    return jsonOk({ client: safeClientDetail(result.value) });
  } catch (error) {
    return jsonError(error);
  }
}
