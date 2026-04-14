import { NextRequest } from "next/server";
import {
  authorizeWorkOrderRead,
  getWorkOrderApiContext,
  jsonOk,
  parseJsonObject,
  revalidateWorkOrderPaths,
  withApiRoute,
} from "@/server/api/work-orders";
import { validationError } from "@/server/services/errors";
import { createAccessDeniedError } from "@/server/authorization";
import type { ClientQuote, ContractorQuote } from "@/server/repositories";
import { USER_ROLES } from "@/types/permissions";

interface RouteContext {
  params: Promise<{ workOrderId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    request,
    "/api/work-orders/[workOrderId]/quote-workflow",
    async (requestContext) => {
      const { workOrderId } = await params;
      const context = await getWorkOrderApiContext(requestContext);
      const workOrder = await context.services.workOrders.getById(workOrderId);
      if (!workOrder.ok) {
        throw workOrder.error;
      }
      await authorizeWorkOrderRead(context, workOrder.value);
      const aggregate = await context.services.quoteWorkflow.getQuotesForWorkOrder(workOrderId);

      if (!aggregate.ok) {
        throw aggregate.error;
      }

      const visible = filterAggregateForActor(context.actor.actorType, aggregate.value, context.actor.actorType === "contractor"
        ? context.actor.scope.contractorOrganizationId
        : null);

      return jsonOk({
        contractorQuotes: visible.contractorQuotes,
        clientQuotes: visible.clientQuotes,
        activeClientQuote: visible.activeClientQuote,
        capabilities: {
          actorType: context.actor.actorType,
          role: context.actor.role,
          canSubmitContractorQuote:
            context.actor.actorType === "contractor" &&
            context.actor.role === USER_ROLES.ContractorUser,
          canReviewContractorQuote:
            context.actor.actorType === "internal" &&
            (context.actor.role === USER_ROLES.Manager ||
              context.actor.role === USER_ROLES.Owner),
          canCreateClientQuote:
            context.actor.actorType === "internal" &&
            (context.actor.role === USER_ROLES.Manager ||
              context.actor.role === USER_ROLES.Owner),
          canSendClientQuote:
            context.actor.actorType === "internal" &&
            (context.actor.role === USER_ROLES.Manager ||
              context.actor.role === USER_ROLES.Owner),
          canApproveClientQuote:
            context.actor.actorType === "client" ||
            (context.actor.actorType === "internal" &&
              (context.actor.role === USER_ROLES.Manager ||
                context.actor.role === USER_ROLES.Owner)),
          canRejectClientQuote:
            context.actor.actorType === "client" ||
            (context.actor.actorType === "internal" &&
              (context.actor.role === USER_ROLES.Manager ||
                context.actor.role === USER_ROLES.Owner)),
        },
      });
    },
  );
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    request,
    "/api/work-orders/[workOrderId]/quote-workflow",
    async (requestContext) => {
      const { workOrderId } = await params;
      const context = await getWorkOrderApiContext(requestContext);
      const workOrder = await context.services.workOrders.getById(workOrderId);
      if (!workOrder.ok) {
        throw workOrder.error;
      }
      await authorizeWorkOrderRead(context, workOrder.value);
      const body = await parseJsonObject(request);
      const action = readRequiredString(body.action, "action");

      if (
        context.actor.actorType === "client" &&
        action !== "approve_client_quote" &&
        action !== "reject_client_quote"
      ) {
        throw createAccessDeniedError();
      }

      const result = await handleAction(action, body, context, workOrderId);
      if (!result.ok) {
        throw result.error;
      }

      revalidateWorkOrderPaths(workOrderId);
      return jsonOk({ quote: result.value });
    },
  );
}

function filterAggregateForActor(
  actorType: "internal" | "client" | "contractor",
  aggregate: {
    contractorQuotes: ContractorQuote[];
    clientQuotes: ClientQuote[];
    activeClientQuote: ClientQuote | null;
  },
  contractorOrganizationId: string | null,
) {
  if (actorType === "internal") {
    return aggregate;
  }

  if (actorType === "contractor") {
    return {
      contractorQuotes: aggregate.contractorQuotes.filter(
        (quote) => quote.contractorOrganizationId === contractorOrganizationId,
      ),
      clientQuotes: [],
      activeClientQuote: null,
    };
  }

  return {
    contractorQuotes: [],
    clientQuotes: aggregate.clientQuotes.filter((quote) =>
      quote.status === "sent" ||
      quote.status === "approved" ||
      quote.status === "rejected",
    ),
    activeClientQuote:
      aggregate.activeClientQuote &&
      (aggregate.activeClientQuote.status === "sent" ||
        aggregate.activeClientQuote.status === "approved" ||
        aggregate.activeClientQuote.status === "rejected")
        ? aggregate.activeClientQuote
        : null,
  };
}

async function handleAction(
  action: string,
  body: Record<string, unknown>,
  context: Awaited<ReturnType<typeof getWorkOrderApiContext>>,
  workOrderId: string,
) {
  switch (action) {
    case "save_contractor_draft":
      return context.services.quoteWorkflow.saveContractorQuoteDraft({
        ...context.audit,
        workOrderId,
        contractorQuoteId: optionalString(body.contractorQuoteId) ?? undefined,
        contractorUserId:
          context.actor.actorType === "contractor" ? context.actor.userId : null,
        contractorOrganizationId:
          context.actor.actorType === "contractor"
            ? context.actor.scope.contractorOrganizationId
            : optionalString(body.contractorOrganizationId),
        lineItems: readLineItems(body.lineItems),
        subtotal: readMoney(body.subtotal, "subtotal"),
        taxAmount: readMoney(body.taxAmount, "taxAmount"),
        totalAmount: readMoney(body.totalAmount, "totalAmount"),
        notes: optionalString(body.notes),
      });
    case "submit_contractor_quote":
      return context.services.quoteWorkflow.submitContractorQuote({
        ...context.audit,
        workOrderId,
        contractorQuoteId: optionalString(body.contractorQuoteId) ?? undefined,
        contractorUserId:
          context.actor.actorType === "contractor" ? context.actor.userId : null,
        contractorOrganizationId:
          context.actor.actorType === "contractor"
            ? context.actor.scope.contractorOrganizationId
            : optionalString(body.contractorOrganizationId),
        lineItems: readLineItems(body.lineItems),
        subtotal: readMoney(body.subtotal, "subtotal"),
        taxAmount: readMoney(body.taxAmount, "taxAmount"),
        totalAmount: readMoney(body.totalAmount, "totalAmount"),
        notes: optionalString(body.notes),
      });
    case "review_contractor_quote":
      return context.services.quoteWorkflow.reviewContractorQuote({
        ...context.audit,
        workOrderId,
        contractorQuoteId: readRequiredString(body.contractorQuoteId, "contractorQuoteId"),
        action:
          readRequiredString(body.decision, "decision") === "accept"
            ? "accept_contractor_quote"
            : "reject_contractor_quote",
        rejectionReason: optionalString(body.rejectionReason),
      });
    case "create_client_quote_from_contractor_quote":
      return context.services.quoteWorkflow.createClientQuoteFromContractorQuote({
        ...context.audit,
        workOrderId,
        contractorQuoteId: readRequiredString(body.contractorQuoteId, "contractorQuoteId"),
        notes: optionalString(body.notes),
      });
    case "create_manual_client_quote":
      return context.services.quoteWorkflow.createManualClientQuote({
        ...context.audit,
        workOrderId,
        sourceContractorQuoteId: optionalString(body.sourceContractorQuoteId) ?? undefined,
        lineItems: readLineItems(body.lineItems),
        subtotal: readMoney(body.subtotal, "subtotal"),
        taxAmount: readMoney(body.taxAmount, "taxAmount"),
        totalAmount: readMoney(body.totalAmount, "totalAmount"),
        notes: optionalString(body.notes),
      });
    case "send_client_quote":
      return context.services.quoteWorkflow.sendClientQuote({
        ...context.audit,
        workOrderId,
        clientQuoteId: readRequiredString(body.clientQuoteId, "clientQuoteId"),
      });
    case "approve_client_quote":
      return context.services.quoteWorkflow.approveClientQuote({
        ...context.audit,
        workOrderId,
        clientQuoteId: readRequiredString(body.clientQuoteId, "clientQuoteId"),
      });
    case "reject_client_quote":
      return context.services.quoteWorkflow.rejectClientQuote({
        ...context.audit,
        workOrderId,
        clientQuoteId: readRequiredString(body.clientQuoteId, "clientQuoteId"),
        rejectionReason: readRequiredString(body.rejectionReason, "rejectionReason"),
      });
    default:
      throw validationError(`Unsupported quote workflow action: ${action}.`);
  }
}

function readRequiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw validationError(`${field} is required.`);
  }

  return value.trim();
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readMoney(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw validationError(`${field} must be a valid number.`);
  }

  return Math.round(value * 100) / 100;
}

function readLineItems(value: unknown) {
  if (!Array.isArray(value)) {
    throw validationError("lineItems must be an array.");
  }

  return value.map((item) => {
    if (!item || typeof item !== "object") {
      throw validationError("Each line item must be an object.");
    }

    const candidate = item as Record<string, unknown>;
    return {
      description: readRequiredString(candidate.description, "description"),
      quantity: readMoney(candidate.quantity, "quantity"),
      unitPrice: readMoney(candidate.unitPrice, "unitPrice"),
      lineTotal: readMoney(candidate.lineTotal, "lineTotal"),
    };
  });
}
