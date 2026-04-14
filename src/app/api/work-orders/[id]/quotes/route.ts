import { NextRequest } from "next/server";
import {
  authorizeWorkOrderRead,
  authorizeQuoteCreate,
  createValidationAppError,
  getWorkOrderApiContext,
  jsonOk,
  parseCreateQuotePayload,
  parseJsonObject,
  revalidateWorkOrderPaths,
  safeQuoteSummaryForActor,
  withApiRoute,
} from "@/server/api/work-orders";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    _request,
    "/api/work-orders/[id]/quotes",
    async (requestContext) => {
    const { id } = await params;
    const context = await getWorkOrderApiContext(requestContext);
    const workOrder = await context.services.workOrders.getById(id);

    if (!workOrder.ok) {
      throw workOrder.error;
    }

    await authorizeWorkOrderRead(context, workOrder.value);

    const quotes = await context.repositories.quotes.listByWorkOrderId(id);
    const visibleQuotes = quotes.items.filter((quote) => {
      if (context.actor.actorType === "internal") {
        return true;
      }

      if (context.actor.actorType === "contractor") {
        return (
          workOrder.value.assignedContractorOrganizationId ===
            context.actor.scope.contractorOrganizationId &&
          (quote.contractorOrganizationId === null ||
            quote.contractorOrganizationId ===
              context.actor.scope.contractorOrganizationId)
        );
      }

      return (
        quote.id === workOrder.value.currentQuoteId &&
        (quote.status === "ready_for_client" ||
          quote.status === "client_approved" ||
          quote.status === "client_rejected")
      );
    });

    return jsonOk({
      quotes: visibleQuotes.map((quote) =>
        safeQuoteSummaryForActor(context.actor, quote),
      ),
    });
    },
  );
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    request,
    "/api/work-orders/[id]/quotes",
    async (requestContext) => {
    const { id } = await params;
    const context = await getWorkOrderApiContext(requestContext);
    const workOrder = await context.services.workOrders.getById(id);

    if (!workOrder.ok) {
      throw workOrder.error;
    }

    await authorizeQuoteCreate(context, workOrder.value);

    const existingQuotes = await context.repositories.quotes.listByWorkOrderId(id);
    const currentQuote = workOrder.value.currentQuoteId
      ? existingQuotes.items.find((quote) => quote.id === workOrder.value.currentQuoteId) ??
        null
      : null;

    if (
      currentQuote &&
      currentQuote.status !== "client_rejected" &&
      currentQuote.status !== "superseded"
    ) {
      throw createValidationAppError(
        "A new quote version can only be created when the current quote was rejected.",
      );
    }

    if (
      context.actor.actorType === "contractor" &&
      workOrder.value.status !== "quote_requested"
    ) {
      throw createValidationAppError(
        "Contractors may only create quotes while a quote is requested.",
      );
    }

    const input = parseCreateQuotePayload(await parseJsonObject(request));
    const result = await context.services.quotes.create({
      ...context.audit,
      workOrderId: id,
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
    });

    if (!result.ok) {
      throw result.error;
    }

    revalidateWorkOrderPaths(id);

    return jsonOk(
      { quote: safeQuoteSummaryForActor(context.actor, result.value) },
      201,
    );
    },
  );
}
