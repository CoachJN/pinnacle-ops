import { NextRequest } from "next/server";
import { jsonError, jsonOk, parseJsonObject } from "@/server/api/business-entities";
import { updateContactSchema } from "@/modules/contacts/domain/schemas";
import { toContactDetail } from "@/server/api/contact-projections";
import { getWorkOrderApiContext } from "@/server/api/work-orders";
import { createAccessDeniedError } from "@/server/authorization";
import { normalizePhaseTwoRouteError } from "@/app/api/_utils/phase-two";

interface RouteContext {
  params: Promise<{ contactId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { contactId } = await params;
    const context = await getWorkOrderApiContext();
    const result = await context.services.contacts.getContact(contactId);
    if (!result.ok) {
      throw result.error;
    }

    if (result.value.organizationId !== context.actor.scope.organizationId) {
      throw createAccessDeniedError("Contact access is restricted to your organization.");
    }

    return jsonOk({ contact: toContactDetail(result.value) });
  } catch (error) {
    return jsonError(normalizePhaseTwoRouteError(error));
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { contactId } = await params;
    const context = await getWorkOrderApiContext();
    if (context.actor.actorType !== "internal") {
      throw createAccessDeniedError("Only internal users can manage contacts.");
    }

    const payload = updateContactSchema.parse(await parseJsonObject(request));
    const result = await context.services.contacts.updateContact({
      ...context.audit,
      contactId,
      ...payload,
    });
    if (!result.ok) {
      throw result.error;
    }

    return jsonOk({ contact: toContactDetail(result.value) });
  } catch (error) {
    return jsonError(normalizePhaseTwoRouteError(error));
  }
}
