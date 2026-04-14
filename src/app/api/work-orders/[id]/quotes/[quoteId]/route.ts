import { NextRequest } from "next/server";
import {
  authorizeQuoteDraftEdit,
  authorizeQuoteRead,
  createNotFoundAppError,
  getWorkOrderApiContext,
  jsonError,
  jsonOk,
  parseJsonObject,
  parseUpdateQuotePayload,
  revalidateWorkOrderPaths,
  safeQuoteSummaryForActor,
} from "@/server/api/work-orders";

interface RouteContext {
  params: Promise<{ id: string; quoteId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id, quoteId } = await params;
    const context = await getWorkOrderApiContext();
    const [workOrder, quote] = await Promise.all([
      context.services.workOrders.getById(id),
      context.repositories.quotes.getById(quoteId),
    ]);

    if (!workOrder.ok) {
      throw workOrder.error;
    }

    if (!quote || quote.isDeleted || quote.workOrderId !== id) {
      throw createNotFoundAppError("Quote could not be found for this work order.");
    }

    await authorizeQuoteRead(context, workOrder.value, quote);

    return jsonOk({ quote: safeQuoteSummaryForActor(context.actor, quote) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id, quoteId } = await params;
    const context = await getWorkOrderApiContext();
    const [workOrder, quote] = await Promise.all([
      context.services.workOrders.getById(id),
      context.repositories.quotes.getById(quoteId),
    ]);

    if (!workOrder.ok) {
      throw workOrder.error;
    }

    if (!quote || quote.isDeleted || quote.workOrderId !== id) {
      throw createNotFoundAppError("Quote could not be found for this work order.");
    }

    await authorizeQuoteDraftEdit(context, workOrder.value, quote);

    const input = parseUpdateQuotePayload(await parseJsonObject(request));
    const result = await context.services.quotes.updateDraft({
      ...context.audit,
      workOrderId: id,
      quoteId,
      contractorOrganizationId:
        context.actor.actorType === "contractor"
          ? context.actor.scope.contractorOrganizationId
          : input.contractorOrganizationId,
      laborAmount: input.laborAmount,
      materialAmount: input.materialAmount,
      otherAmount: input.otherAmount,
      currency: input.currency,
      scopeSummary: input.scopeSummary,
      contractorNotes: input.contractorNotes,
      internalReviewNotes:
        context.actor.actorType === "internal"
          ? input.internalReviewNotes
          : undefined,
    });

    if (!result.ok) {
      throw result.error;
    }

    revalidateWorkOrderPaths(id);

    return jsonOk({ quote: safeQuoteSummaryForActor(context.actor, result.value) });
  } catch (error) {
    return jsonError(error);
  }
}
