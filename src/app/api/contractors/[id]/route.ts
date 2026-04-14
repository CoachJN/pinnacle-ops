import { NextRequest } from "next/server";
import {
  authorizeContractorEdit,
  authorizeContractorRead,
  getBusinessEntityApiContext,
  jsonError,
  jsonOk,
  parseJsonObject,
  parseUpdateContractorPayload,
  revalidateContractorPaths,
  safeContractorDetail,
} from "@/server/api/business-entities";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const context = await getBusinessEntityApiContext();
    const result = await context.services.contractors.getContractorOrganization(id);

    if (!result.ok) {
      throw result.error;
    }

    authorizeContractorRead(context, result.value);

    return jsonOk({ contractor: safeContractorDetail(result.value) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const context = await getBusinessEntityApiContext();
    const existing = await context.services.contractors.getContractorOrganization(id);

    if (!existing.ok) {
      throw existing.error;
    }

    authorizeContractorEdit(context, existing.value);

    const input = parseUpdateContractorPayload(await parseJsonObject(request));
    const result = await context.services.contractors.updateContractorOrganization({
      ...context.audit,
      contractorOrganizationId: id,
      ...input,
    });

    if (!result.ok) {
      throw result.error;
    }

    revalidateContractorPaths(result.value.id);

    return jsonOk({ contractor: safeContractorDetail(result.value) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const context = await getBusinessEntityApiContext();
    const existing = await context.services.contractors.getContractorOrganization(id);

    if (!existing.ok) {
      throw existing.error;
    }

    authorizeContractorEdit(context, existing.value);

    const result =
      await context.services.contractors.archiveContractorOrganization({
        ...context.audit,
        contractorOrganizationId: id,
      });

    if (!result.ok) {
      throw result.error;
    }

    revalidateContractorPaths(result.value.id);

    return jsonOk({ contractor: safeContractorDetail(result.value) });
  } catch (error) {
    return jsonError(error);
  }
}
