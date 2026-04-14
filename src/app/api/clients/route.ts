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
  safeClientDetail,
  safeClientSummary,
} from "@/server/api/business-entities";

export async function GET(request: NextRequest) {
  try {
    const context = await getBusinessEntityApiContext();
    const clients = await listClientsForActor(
      context,
      parseEntityListLimit(request),
    );

    return jsonOk({ clients: clients.map(safeClientSummary) });
  } catch (error) {
    return jsonError(error);
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

    return jsonOk({ client: safeClientDetail(result.value) }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
