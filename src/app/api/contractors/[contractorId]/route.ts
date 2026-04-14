import { NextRequest } from "next/server";
import { normalizePhaseTwoRouteError } from "@/app/api/_utils/phase-two";
import { updateContractorSchema } from "@/modules/contractors";
import { mapContractorOrganizationToContractor } from "@/modules/contractors/server/mappers";
import {
  authorizeContractorEdit,
  authorizeContractorRead,
  getBusinessEntityApiContext,
  jsonError,
  jsonOk,
  parseJsonObject,
  revalidateContractorPaths,
} from "@/server/api/business-entities";
import { createAccessDeniedError } from "@/server/authorization";

interface ContractorRouteContext {
  params: Promise<{ contractorId: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: ContractorRouteContext,
) {
  try {
    const { contractorId } = await params;
    const context = await getBusinessEntityApiContext();
    assertInternalActor(context);

    const result =
      await context.services.contractors.getContractorOrganization(contractorId);

    if (!result.ok) {
      throw result.error;
    }

    authorizeContractorRead(context, result.value);

    return jsonOk({
      contractor: mapContractorOrganizationToContractor(result.value),
    });
  } catch (error) {
    return jsonError(normalizePhaseTwoRouteError(error));
  }
}

export async function PUT(
  request: NextRequest,
  { params }: ContractorRouteContext,
) {
  try {
    const { contractorId } = await params;
    const context = await getBusinessEntityApiContext();
    assertInternalActor(context);

    const existing =
      await context.services.contractors.getContractorOrganization(contractorId);
    if (!existing.ok) {
      throw existing.error;
    }

    authorizeContractorEdit(context, existing.value);

    const input = updateContractorSchema.parse(await parseJsonObject(request));
    const result = await context.services.contractors.updateContractorOrganization({
      ...context.audit,
      contractorOrganizationId: contractorId,
      name: input.name,
      displayName: input.company,
      status: input.status,
      primaryContactName: input.name,
      primaryContactEmail: input.email,
      primaryContactPhone: input.phone,
      serviceCategories: input.serviceCategories,
      serviceAreas: input.serviceAreas,
      notes: input.notes,
    });

    if (!result.ok) {
      throw result.error;
    }

    revalidateContractorPaths(result.value.id);

    return jsonOk({
      contractor: mapContractorOrganizationToContractor(result.value),
    });
  } catch (error) {
    return jsonError(normalizePhaseTwoRouteError(error));
  }
}

function assertInternalActor(
  context: Awaited<ReturnType<typeof getBusinessEntityApiContext>>,
) {
  if (context.actor.actorType !== "internal") {
    throw createAccessDeniedError(
      "Only internal users can access contractor management.",
    );
  }
}
