import { NextRequest } from "next/server";
import { normalizePhaseTwoRouteError } from "@/app/api/_utils/phase-two";
import { contractorListQuerySchema, createContractorSchema } from "@/modules/contractors";
import { mapContractorOrganizationToContractor } from "@/modules/contractors/server/mappers";
import {
  authorizeContractorCreate,
  authorizeContractorRead,
  getBusinessEntityApiContext,
  jsonError,
  jsonOk,
  parseJsonObject,
  revalidateContractorPaths,
  safeContractorDetail,
  safeContractorSummary,
} from "@/server/api/business-entities";
import { createAccessDeniedError } from "@/server/authorization";

export async function GET(request: NextRequest) {
  try {
    const context = await getBusinessEntityApiContext();
    assertInternalActor(context);

    const query = contractorListQuerySchema.parse({
      search: request.nextUrl.searchParams.get("search") ?? undefined,
      status: request.nextUrl.searchParams.get("status") ?? undefined,
      limit: parseLimit(request.nextUrl.searchParams.get("limit")),
    });

    const result = await context.services.contractors.listContractorOrganizations({
      organizationId: context.actor.scope.organizationId,
      status: query.status,
      search: query.search,
      limit: query.limit ?? 100,
    });

    if (!result.ok) {
      throw result.error;
    }

    return jsonOk({
      contractors: await Promise.all(
        result.value.map(async (contractorOrganization) => {
          authorizeContractorRead(context, contractorOrganization);
          return {
            ...mapContractorOrganizationToContractor(contractorOrganization),
            ...(await safeContractorSummary(context.repositories, contractorOrganization)),
          };
        }),
      ),
    });
  } catch (error) {
    return jsonError(normalizePhaseTwoRouteError(error));
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getBusinessEntityApiContext();
    assertInternalActor(context);
    authorizeContractorCreate(context);

    const input = createContractorSchema.parse(await parseJsonObject(request));
    const result = await context.services.contractors.createContractorOrganization({
      ...context.audit,
      name: input.legalName,
      displayName: input.displayName ?? null,
      parentContractorId: input.parentContractorId ?? null,
      status: input.status,
      isAssignable: input.isAssignable,
      businessEmail: input.businessEmail ?? null,
      mainPhone: input.mainPhone ?? null,
      altPhone: input.altPhone ?? null,
      fax: input.fax ?? null,
      primaryContactId: input.primaryContactId ?? null,
      billingContactId: input.billingContactId ?? null,
      dispatchContactId: input.dispatchContactId ?? null,
      trades: input.trades,
      serviceArea: input.serviceArea ?? null,
      notes: input.notes,
    });

    if (!result.ok) {
      throw result.error;
    }

    revalidateContractorPaths(result.value.id);

    return jsonOk(
      {
        contractor: {
          ...mapContractorOrganizationToContractor(result.value),
          ...(await safeContractorDetail(context.repositories, result.value)),
        },
      },
      201,
    );
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

function parseLimit(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}
