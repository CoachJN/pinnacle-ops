import { NextRequest } from "next/server";
import {
  authorizeContractorCreate,
  getBusinessEntityApiContext,
  jsonError,
  jsonOk,
  listContractorsForActor,
  parseCreateContractorPayload,
  parseEntityListLimit,
  parseJsonObject,
  revalidateContractorPaths,
  safeContractorDetail,
  safeContractorSummary,
} from "@/server/api/business-entities";

export async function GET(request: NextRequest) {
  try {
    const context = await getBusinessEntityApiContext();
    const contractors = await listContractorsForActor(
      context,
      parseEntityListLimit(request),
    );

    return jsonOk({ contractors: contractors.map(safeContractorSummary) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getBusinessEntityApiContext();
    authorizeContractorCreate(context);

    const input = parseCreateContractorPayload(await parseJsonObject(request));
    const result = await context.services.contractors.createContractorOrganization({
      ...context.audit,
      ...input,
    });

    if (!result.ok) {
      throw result.error;
    }

    revalidateContractorPaths(result.value.id);

    return jsonOk({ contractor: safeContractorDetail(result.value) }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
