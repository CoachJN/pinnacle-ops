import { NextRequest } from "next/server";
import { jsonError, jsonOk, parseJsonObject } from "@/server/api/business-entities";
import { createContactSchema } from "@/modules/contacts/domain/schemas";
import { toContactDetail, toContactSummary } from "@/server/api/contact-projections";
import { getWorkOrderApiContext } from "@/server/api/work-orders";
import { createAccessDeniedError } from "@/server/authorization";
import { normalizePhaseTwoRouteError } from "@/app/api/_utils/phase-two";

export async function GET(request: NextRequest) {
  try {
    const context = await getWorkOrderApiContext();
    const ids = parseIdList(request.nextUrl.searchParams.get("ids"));
    const clientOrganizationId = request.nextUrl.searchParams.get("clientOrganizationId")?.trim();
    const locationId = request.nextUrl.searchParams.get("locationId")?.trim();
    const contractorId = request.nextUrl.searchParams.get("contractorId")?.trim();

    assertCanReadRequestedScope(context, {
      clientOrganizationId,
      locationId,
      contractorId,
    });

    const result = await context.services.contacts.listContacts({
      organizationId: context.actor.scope.organizationId,
      ids,
      clientOrganizationId,
      locationId,
      contractorId,
      limit: 100,
    });
    if (!result.ok) {
      throw result.error;
    }

    return jsonOk({
      contacts:
        ids && ids.length === 1 && !clientOrganizationId && !locationId && !contractorId
          ? result.value.map(toContactDetail)
          : result.value.map(toContactSummary),
    });
  } catch (error) {
    return jsonError(normalizePhaseTwoRouteError(error));
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getWorkOrderApiContext();
    if (context.actor.actorType !== "internal") {
      throw createAccessDeniedError("Only internal users can manage contacts.");
    }

    const payload = createContactSchema.parse(await parseJsonObject(request));
    const result = await context.services.contacts.createContact({
      ...context.audit,
      ...payload,
    });
    if (!result.ok) {
      throw result.error;
    }

    return jsonOk({ contact: toContactDetail(result.value) }, 201);
  } catch (error) {
    return jsonError(normalizePhaseTwoRouteError(error));
  }
}

function parseIdList(value: string | null): string[] | undefined {
  if (!value) {
    return undefined;
  }

  const ids = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return ids.length > 0 ? ids : undefined;
}

function assertCanReadRequestedScope(
  context: Awaited<ReturnType<typeof getWorkOrderApiContext>>,
  scope: {
    clientOrganizationId?: string;
    locationId?: string;
    contractorId?: string;
  },
) {
  if (context.actor.actorType === "internal") {
    return;
  }

  if (context.actor.actorType === "client") {
    if (scope.contractorId) {
      throw createAccessDeniedError("Client users cannot read contractor contacts.");
    }

    if (
      scope.clientOrganizationId &&
      scope.clientOrganizationId !== context.actor.scope.clientOrganizationId
    ) {
      throw createAccessDeniedError("Client users cannot read another client's contacts.");
    }

    return;
  }

  if (scope.clientOrganizationId || scope.locationId) {
    throw createAccessDeniedError("Contractor users cannot read client contacts.");
  }

  if (
    scope.contractorId &&
    scope.contractorId !== context.actor.scope.contractorOrganizationId
  ) {
    throw createAccessDeniedError("Contractor users cannot read another contractor's contacts.");
  }
}
