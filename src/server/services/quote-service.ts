import "server-only";

import type { FirestoreRepositories, Quote } from "@/server/repositories";
import type { EntityId } from "@/types/entity";
import type { InvoiceCurrency } from "@/types/invoice";
import type { UserRole } from "@/types/permissions";
import type { QuoteStatus } from "@/types/quote";
import type { WorkOrderStatus } from "@/types/work-order";
import { invalidTransitionError, notFoundError, validationError } from "./errors.ts";
import type { ActivityLogService } from "./activity-log-service.ts";
import type { NotificationService } from "./notification-service.ts";
import { createServiceLogger } from "./observability.ts";
import {
  canQuoteTransition,
  isTerminalQuoteStatus,
} from "./status-rules.ts";
import {
  createAuditFields,
  serviceFail,
  serviceOk,
  touchAuditFields,
  type ServiceAuditContext,
  type ServiceResult,
} from "./types.ts";

export interface QuoteService {
  create(input: CreateQuoteServiceInput): Promise<ServiceResult<Quote>>;
  updateDraft(input: UpdateQuoteDraftInput): Promise<ServiceResult<Quote>>;
  transition(input: TransitionQuoteInput): Promise<ServiceResult<Quote>>;
}

export interface CreateQuoteServiceInput extends ServiceAuditContext {
  workOrderId: EntityId;
  contractorOrganizationId?: EntityId | null;
  laborAmount: number;
  materialAmount: number;
  otherAmount: number;
  currency: InvoiceCurrency;
  scopeSummary: string;
  contractorNotes?: string | null;
}

export interface UpdateQuoteDraftInput extends CreateQuoteServiceInput {
  quoteId: EntityId;
  internalReviewNotes?: string | null;
}

export interface TransitionQuoteInput extends ServiceAuditContext {
  workOrderId: EntityId;
  quoteId: EntityId;
  toStatus: QuoteStatus;
  internalReviewNotes?: string | null;
  clientResponseNotes?: string | null;
}

export function createQuoteService(
  repositories: Pick<FirestoreRepositories, "workOrders" | "quotes">,
  dependencies: {
    activityLogs: ActivityLogService;
    notifications?: NotificationService;
  },
): QuoteService {
  return new FirestoreQuoteService(repositories, dependencies);
}

class FirestoreQuoteService implements QuoteService {
  private readonly repositories: Pick<
    FirestoreRepositories,
    "workOrders" | "quotes"
  >;

  private readonly dependencies: {
    activityLogs: ActivityLogService;
    notifications?: NotificationService;
  };

  constructor(
    repositories: Pick<FirestoreRepositories, "workOrders" | "quotes">,
    dependencies: {
      activityLogs: ActivityLogService;
      notifications?: NotificationService;
    },
  ) {
    this.repositories = repositories;
    this.dependencies = dependencies;
  }

  async create(input: CreateQuoteServiceInput): Promise<ServiceResult<Quote>> {
    const logger = createServiceLogger("quote.create", input);
    const workOrder = await this.repositories.workOrders.getById(input.workOrderId);
    if (!workOrder || workOrder.isDeleted) {
      return serviceFail(notFoundError("Work order could not be found."));
    }

    if (
      workOrder.status !== "quote_requested" &&
      workOrder.status !== "quote_received" &&
      workOrder.status !== "pending_client_approval"
    ) {
      return serviceFail(
        validationError("Quotes can only be created for quote-required work orders."),
      );
    }

    const totals = validateQuoteTotals(input);
    if (!totals.ok) {
      return totals;
    }

    const existingQuotes = await this.repositories.quotes.listByWorkOrderId(
      input.workOrderId,
    );
    const nextVersion =
      existingQuotes.items.reduce(
        (latest, quote) => Math.max(latest, quote.versionNumber),
        0,
      ) + 1;

    const currentQuote = workOrder.currentQuoteId
      ? await this.repositories.quotes.getById(workOrder.currentQuoteId)
      : null;
    if (currentQuote && !isTerminalQuoteStatus(currentQuote.status)) {
      await this.repositories.quotes.save(
        touchAuditFields(
          {
            ...currentQuote,
            status: "superseded",
          },
          input,
        ),
      );
    }

    const quote: Quote = {
      id: this.repositories.quotes.newId(),
      ...createAuditFields(input),
      workOrderId: workOrder.id,
      clientOrganizationId: workOrder.clientOrganizationId,
      locationId: workOrder.locationId,
      contractorOrganizationId: input.contractorOrganizationId ?? null,
      versionNumber: nextVersion,
      status: "draft",
      laborAmount: input.laborAmount,
      materialAmount: input.materialAmount,
      otherAmount: input.otherAmount,
      totalAmount: totals.value,
      currency: input.currency,
      scopeSummary: input.scopeSummary.trim(),
      contractorNotes: input.contractorNotes ?? null,
      internalReviewNotes: null,
      clientResponseNotes: null,
      submittedByUserId: null,
      submittedAt: null,
      reviewedAt: null,
      clientDecisionAt: null,
      workOrderSnapshot: {
        id: workOrder.id,
        name: workOrder.workOrderNumber,
      },
      contractorSnapshot:
        input.contractorOrganizationId &&
        workOrder.assignedContractorOrganizationId === input.contractorOrganizationId
          ? workOrder.contractorSnapshot
          : null,
    };

    const updatedWorkOrder = touchAuditFields(
      {
        ...workOrder,
        currentQuoteId: quote.id,
      },
      input,
    );

    await this.repositories.quotes.create(quote);
    await this.repositories.workOrders.save(updatedWorkOrder);
    await this.dependencies.activityLogs.record({
      ...input,
      workOrderId: workOrder.id,
      action: nextVersion > 1 ? "client_quote.updated" : "client_quote.created",
      eventType: nextVersion > 1 ? "quote_revised" : "quote_created",
      message:
        nextVersion > 1
          ? `Created revised quote version ${nextVersion}.`
          : `Created quote draft version ${nextVersion}.`,
      entityType: "quote",
      entityId: quote.id,
      entityLabel: `Quote v${quote.versionNumber}`,
      visibility: quoteActivityVisibility("draft", input.actor.role),
      changes: [
        { field: "versionNumber", to: quote.versionNumber },
        { field: "status", to: quote.status },
        { field: "totalAmount", to: quote.totalAmount },
      ],
      metadata: {
        versionNumber: quote.versionNumber,
        totalAmount: quote.totalAmount,
        currency: quote.currency,
      },
    });
    logger.info("use_case.completed", {
      action: nextVersion > 1 ? "client_quote.updated" : "client_quote.created",
      resource: {
        type: "quote",
        id: quote.id,
        label: `Quote v${quote.versionNumber}`,
      },
      workOrderId: workOrder.id,
    });

    return serviceOk(quote);
  }

  async updateDraft(input: UpdateQuoteDraftInput): Promise<ServiceResult<Quote>> {
    const logger = createServiceLogger("quote.update_draft", input);
    const quote = await this.getQuoteForWorkOrder(input.workOrderId, input.quoteId);
    if (!quote.ok) {
      return quote;
    }

    if (quote.value.status !== "draft") {
      return serviceFail(validationError("Only draft quotes can be edited."));
    }

    const totals = validateQuoteTotals(input);
    if (!totals.ok) {
      return totals;
    }

    const updated = touchAuditFields(
      {
        ...quote.value,
        contractorOrganizationId: input.contractorOrganizationId ?? null,
        laborAmount: input.laborAmount,
        materialAmount: input.materialAmount,
        otherAmount: input.otherAmount,
        totalAmount: totals.value,
        currency: input.currency,
        scopeSummary: input.scopeSummary.trim(),
        contractorNotes: input.contractorNotes ?? null,
        internalReviewNotes:
          input.internalReviewNotes ?? quote.value.internalReviewNotes,
      },
      input,
    );

    await this.repositories.quotes.save(updated);
    await this.dependencies.activityLogs.record({
      ...input,
      workOrderId: updated.workOrderId,
      action: "client_quote.updated",
      eventType: "quote_updated",
      message: `Updated quote version ${updated.versionNumber}.`,
      entityType: "quote",
      entityId: updated.id,
      entityLabel: `Quote v${updated.versionNumber}`,
      visibility: quoteActivityVisibility(updated.status, input.actor.role),
      metadata: {
        versionNumber: updated.versionNumber,
        totalAmount: updated.totalAmount,
        currency: updated.currency,
      },
    });
    logger.info("use_case.completed", {
      action: "client_quote.updated",
      resource: {
        type: "quote",
        id: updated.id,
        label: `Quote v${updated.versionNumber}`,
      },
    });

    return serviceOk(updated);
  }

  async transition(input: TransitionQuoteInput): Promise<ServiceResult<Quote>> {
    const logger = createServiceLogger("quote.transition", input);
    const quote = await this.getQuoteForWorkOrder(input.workOrderId, input.quoteId);
    if (!quote.ok) {
      return quote;
    }

    if (isTerminalQuoteStatus(quote.value.status)) {
      return serviceFail(
        invalidTransitionError(`Quote status ${quote.value.status} is terminal.`),
      );
    }

    if (!canQuoteTransition(quote.value.status, input.toStatus)) {
      return serviceFail(
        invalidTransitionError(
          `Quote cannot transition from ${quote.value.status} to ${input.toStatus}.`,
        ),
      );
    }

    const timestamp = input.now ?? new Date().toISOString();
    const transitioned = touchAuditFields(
      {
        ...quote.value,
        status: input.toStatus,
        submittedByUserId:
          input.toStatus === "submitted"
            ? input.actor.userId
            : quote.value.submittedByUserId,
        submittedAt:
          input.toStatus === "submitted"
            ? quote.value.submittedAt ?? timestamp
            : quote.value.submittedAt,
        reviewedAt:
          input.toStatus === "ready_for_client"
            ? quote.value.reviewedAt ?? timestamp
            : quote.value.reviewedAt,
        clientDecisionAt:
          input.toStatus === "client_approved" ||
          input.toStatus === "client_rejected"
            ? quote.value.clientDecisionAt ?? timestamp
            : quote.value.clientDecisionAt,
        internalReviewNotes:
          input.internalReviewNotes ?? quote.value.internalReviewNotes,
        clientResponseNotes:
          input.clientResponseNotes ?? quote.value.clientResponseNotes,
      },
      { ...input, now: timestamp },
    );

    await this.repositories.quotes.save(transitioned);
    await this.applyWorkOrderReaction(transitioned, input);
    await this.dependencies.activityLogs.record({
      ...input,
      now: timestamp,
      workOrderId: transitioned.workOrderId,
      action: "client_quote.status_changed",
      eventType: "quote_status_changed",
      message: `Changed quote status from ${quote.value.status} to ${input.toStatus}.`,
      entityType: "quote",
      entityId: transitioned.id,
      entityLabel: `Quote v${transitioned.versionNumber}`,
      visibility: quoteActivityVisibility(input.toStatus, input.actor.role),
      changes: [
        { field: "status", from: quote.value.status, to: input.toStatus },
      ],
      metadata: {
        fromStatus: quote.value.status,
        toStatus: input.toStatus,
      },
    });
    logger.info("use_case.completed", {
      action: "client_quote.status_changed",
      resource: {
        type: "quote",
        id: transitioned.id,
        label: `Quote v${transitioned.versionNumber}`,
      },
      fromStatus: quote.value.status,
      toStatus: input.toStatus,
    });

    const notificationEventType =
      input.toStatus === "submitted"
        ? "quote_submitted"
        : input.toStatus === "ready_for_client"
          ? "quote_awaiting_client_action"
          : null;

    if (notificationEventType) {
      const workOrder = await this.repositories.workOrders.getById(transitioned.workOrderId);
      await this.dependencies.notifications?.captureOperationalEvent({
        ...input,
        now: timestamp,
        eventType: notificationEventType,
        entityType: "quote",
        entityId: transitioned.id,
        workOrder,
        quote: transitioned,
        fromStatus: quote.value.status,
        toStatus: input.toStatus,
      });

      if (input.toStatus === "submitted") {
        await this.dependencies.notifications?.captureOperationalEvent({
          ...input,
          now: timestamp,
          eventType: "quote_awaiting_manager_review",
          entityType: "quote",
          entityId: transitioned.id,
          workOrder,
          quote: transitioned,
          fromStatus: quote.value.status,
          toStatus: input.toStatus,
        });
      }
    }

    return serviceOk(transitioned);
  }

  private async getQuoteForWorkOrder(
    workOrderId: EntityId,
    quoteId: EntityId,
  ): Promise<ServiceResult<Quote>> {
    const quote = await this.repositories.quotes.getById(quoteId);
    if (!quote || quote.isDeleted || quote.workOrderId !== workOrderId) {
      return serviceFail(notFoundError("Quote could not be found for this work order."));
    }

    return serviceOk(quote);
  }

  private async applyWorkOrderReaction(
    quote: Quote,
    input: TransitionQuoteInput,
  ): Promise<void> {
    const workOrder = await this.repositories.workOrders.getById(quote.workOrderId);
    if (!workOrder || workOrder.isDeleted || workOrder.currentQuoteId !== quote.id) {
      return;
    }

    const nextStatusByQuoteStatus: Partial<Record<QuoteStatus, typeof workOrder.status>> = {
      submitted: "quote_received",
      ready_for_client: "pending_client_approval",
      client_approved: "approved_to_proceed",
      client_rejected: "quote_requested",
    };

    const nextStatus = nextStatusByQuoteStatus[quote.status];
    if (!nextStatus || workOrder.status === nextStatus) {
      return;
    }

    const transitionedWorkOrder = touchAuditFields(
      {
        ...workOrder,
        status: nextStatus,
        approvedAt:
          nextStatus === "approved_to_proceed"
            ? workOrder.approvedAt ?? input.now ?? new Date().toISOString()
            : workOrder.approvedAt,
      },
      input,
    );
    await this.repositories.workOrders.save(transitionedWorkOrder);
    await this.dependencies.activityLogs.record({
      ...input,
      workOrderId: workOrder.id,
      action: "work_order.status_changed",
      eventType: "work_order_status_changed",
      message: `Quote workflow changed work order status from ${workOrder.status} to ${nextStatus}.`,
      entityType: "workOrder",
      entityId: workOrder.id,
      entityLabel: workOrder.workOrderNumber,
      visibility: workOrderActivityVisibility(nextStatus),
      changes: [
        { field: "status", from: workOrder.status, to: nextStatus },
      ],
      metadata: {
        fromStatus: workOrder.status,
        toStatus: nextStatus,
        triggeredByQuoteStatus: quote.status,
        quoteId: quote.id,
      },
    });
  }
}

function quoteActivityVisibility(
  status: QuoteStatus,
  actorRole: UserRole | "system",
): "internal" | "client" | "contractor" | "all" {
  if (status === "ready_for_client") {
    return "client";
  }

  if (status === "client_approved" || status === "client_rejected") {
    return "all";
  }

  if (actorRole === "contractor_user") {
    return "contractor";
  }

  return "internal";
}

function workOrderActivityVisibility(
  status: WorkOrderStatus,
): "internal" | "client" | "contractor" | "all" {
  if (status === "pending_client_approval") {
    return "client";
  }

  if (status === "approved_to_proceed" || status === "quote_requested") {
    return "all";
  }

  return "internal";
}

function validateQuoteTotals(input: {
  laborAmount: number;
  materialAmount: number;
  otherAmount: number;
  scopeSummary: string;
}): ServiceResult<number> {
  if (!input.scopeSummary.trim()) {
    return serviceFail(validationError("Quote scope summary is required."));
  }

  const amounts = [input.laborAmount, input.materialAmount, input.otherAmount];
  if (amounts.some((amount) => !Number.isFinite(amount) || amount < 0)) {
    return serviceFail(validationError("Quote amounts must be zero or greater."));
  }

  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  if (total <= 0) {
    return serviceFail(validationError("Quote total must be greater than zero."));
  }

  return serviceOk(total);
}
