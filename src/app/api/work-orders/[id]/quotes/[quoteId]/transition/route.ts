import { NextRequest } from "next/server";
import {
  authorizeQuoteTransition,
  createNotFoundAppError,
  getWorkOrderApiContext,
  jsonOk,
  parseJsonObject,
  parseQuoteTransitionPayload,
  revalidateWorkOrderPaths,
  safeQuoteSummaryForActor,
  withApiRoute,
} from "@/server/api/work-orders";

interface RouteContext {
  params: Promise<{ id: string; quoteId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    request,
    "/api/work-orders/[id]/quotes/[quoteId]/transition",
    async (requestContext) => {
    const { id, quoteId } = await params;
    const context = await getWorkOrderApiContext(requestContext);
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

    const input = parseQuoteTransitionPayload(await parseJsonObject(request));
    await authorizeQuoteTransition(context, workOrder.value, quote, input.toStatus);

    const result = await context.services.quotes.transition({
      ...context.audit,
      workOrderId: id,
      quoteId,
      ...input,
    });

    if (!result.ok) {
      throw result.error;
    }

    revalidateWorkOrderPaths(id);

    return jsonOk({ quote: safeQuoteSummaryForActor(context.actor, result.value) });
    },
  );
}
