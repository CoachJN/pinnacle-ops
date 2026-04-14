import "server-only";

import type {
  ClientQuote,
  ContractorQuote,
  FirestoreRepositories,
  WorkOrder,
} from "@/server/repositories";
import {
  approveClientQuoteSchema,
  canTransitionClientQuote,
  canTransitionContractorQuote,
  createClientQuoteSchema,
  rejectClientQuoteSchema,
  reviewContractorQuoteSchema,
  saveContractorQuoteDraftSchema,
  sendClientQuoteSchema,
  submitContractorQuoteSchema,
} from "@/lib/validation/quote";
import type {
  ContractorQuoteStatus,
  QuoteLineItem,
} from "@/types/quote";
import { USER_ROLES, type UserRole } from "@/types/permissions";
import { invalidTransitionError, notFoundError, validationError } from "./errors";
import type { ActivityLogService } from "./activity-log-service";
import type { NotificationService } from "./notification-service";
import {
  createAuditFields,
  serviceFail,
  serviceOk,
  touchAuditFields,
  type ServiceAuditContext,
  type ServiceResult,
} from "./types";

export interface QuoteWorkflowAggregate {
  contractorQuotes: ContractorQuote[];
  clientQuotes: ClientQuote[];
  activeClientQuote: ClientQuote | null;
}

export interface SaveContractorQuoteDraftInput extends ServiceAuditContext {
  contractorQuoteId?: string;
  workOrderId: string;
  contractorUserId?: string | null;
  contractorOrganizationId?: string | null;
  lineItems: QuoteLineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string | null;
}

export type SubmitContractorQuoteInput = SaveContractorQuoteDraftInput;

export interface ReviewContractorQuoteInput extends ServiceAuditContext {
  workOrderId: string;
  contractorQuoteId: string;
  action: "accept_contractor_quote" | "reject_contractor_quote";
  rejectionReason?: string | null;
}

export interface CreateClientQuoteFromContractorQuoteInput extends ServiceAuditContext {
  workOrderId: string;
  contractorQuoteId: string;
  notes?: string | null;
}

export interface CreateManualClientQuoteInput extends ServiceAuditContext {
  workOrderId: string;
  sourceContractorQuoteId?: string | null;
  lineItems: QuoteLineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string | null;
}

export interface ClientQuoteActionInput extends ServiceAuditContext {
  workOrderId: string;
  clientQuoteId: string;
}

export interface RejectClientQuoteInput extends ClientQuoteActionInput {
  rejectionReason: string;
}

export interface QuoteWorkflowService {
  saveContractorQuoteDraft(
    input: SaveContractorQuoteDraftInput,
  ): Promise<ServiceResult<ContractorQuote>>;
  submitContractorQuote(
    input: SubmitContractorQuoteInput,
  ): Promise<ServiceResult<ContractorQuote>>;
  getQuotesForWorkOrder(
    workOrderId: string,
  ): Promise<ServiceResult<QuoteWorkflowAggregate>>;
  reviewContractorQuote(
    input: ReviewContractorQuoteInput,
  ): Promise<ServiceResult<ContractorQuote>>;
  createClientQuoteFromContractorQuote(
    input: CreateClientQuoteFromContractorQuoteInput,
  ): Promise<ServiceResult<ClientQuote>>;
  createManualClientQuote(
    input: CreateManualClientQuoteInput,
  ): Promise<ServiceResult<ClientQuote>>;
  sendClientQuote(input: ClientQuoteActionInput): Promise<ServiceResult<ClientQuote>>;
  approveClientQuote(input: ClientQuoteActionInput): Promise<ServiceResult<ClientQuote>>;
  rejectClientQuote(input: RejectClientQuoteInput): Promise<ServiceResult<ClientQuote>>;
  getActiveClientQuoteForWorkOrder(
    workOrderId: string,
  ): Promise<ServiceResult<ClientQuote | null>>;
}

export function createQuoteWorkflowService(
  repositories: Pick<
    FirestoreRepositories,
    "workOrders" | "contractorQuotes" | "clientQuotes"
  >,
  dependencies: {
    activityLogs: ActivityLogService;
    notifications?: NotificationService;
  },
): QuoteWorkflowService {
  return new DefaultQuoteWorkflowService(repositories, dependencies);
}

class DefaultQuoteWorkflowService implements QuoteWorkflowService {
  private readonly repositories: Pick<
    FirestoreRepositories,
    "workOrders" | "contractorQuotes" | "clientQuotes"
  >;

  private readonly dependencies: {
    activityLogs: ActivityLogService;
    notifications?: NotificationService;
  };

  constructor(
    repositories: Pick<
      FirestoreRepositories,
      "workOrders" | "contractorQuotes" | "clientQuotes"
    >,
    dependencies: {
      activityLogs: ActivityLogService;
      notifications?: NotificationService;
    },
  ) {
    this.repositories = repositories;
    this.dependencies = dependencies;
  }

  async saveContractorQuoteDraft(
    input: SaveContractorQuoteDraftInput,
  ): Promise<ServiceResult<ContractorQuote>> {
    const parsed = saveContractorQuoteDraftSchema.safeParse(input);
    if (!parsed.success) {
      return serviceFail(validationError(parsed.error.issues[0]?.message ?? "Invalid contractor quote draft."));
    }

    const workOrder = await this.requireWorkOrder(input.workOrderId);
    if (!workOrder.ok) {
      return workOrder;
    }

    if (!canSaveContractorQuoteDraft(input.actor.role)) {
      return serviceFail(validationError("You do not have permission to save a contractor quote draft."));
    }

    if (workOrder.value.status !== "quote_requested") {
      return serviceFail(
        validationError("Contractor quotes can only be drafted while the work order is awaiting a quote."),
      );
    }

    if (
      input.actor.role === USER_ROLES.ContractorUser &&
      workOrder.value.assignedContractorOrganizationId !== input.contractorOrganizationId
    ) {
      return serviceFail(validationError("Contractors may only save quotes for their own assigned work orders."));
    }

    const existing = input.contractorQuoteId
      ? await this.repositories.contractorQuotes.getById(input.contractorQuoteId)
      : null;

    if (
      existing &&
      (existing.workOrderId !== workOrder.value.id || existing.status !== "draft")
    ) {
      return serviceFail(validationError("Only draft contractor quotes can be edited."));
    }

    const quote: ContractorQuote = existing
      ? touchAuditFields(
          {
            ...existing,
            contractorUserId: input.contractorUserId ?? existing.contractorUserId,
            contractorOrganizationId:
              input.contractorOrganizationId ?? existing.contractorOrganizationId,
            lineItems: parsed.data.lineItems,
            subtotal: parsed.data.subtotal,
            taxAmount: parsed.data.taxAmount,
            totalAmount: parsed.data.totalAmount,
            notes: parsed.data.notes ?? null,
          },
          input,
        )
      : {
          id: this.repositories.contractorQuotes.newId(),
          ...createAuditFields(input),
          workOrderId: workOrder.value.id,
          contractorUserId: input.contractorUserId ?? null,
          contractorOrganizationId: input.contractorOrganizationId ?? null,
          clientOrganizationId: workOrder.value.clientOrganizationId,
          locationId: workOrder.value.locationId,
          lineItems: parsed.data.lineItems,
          subtotal: parsed.data.subtotal,
          taxAmount: parsed.data.taxAmount,
          totalAmount: parsed.data.totalAmount,
          notes: parsed.data.notes ?? null,
          status: "draft",
          submittedAt: null,
          reviewedAt: null,
          reviewedByUserId: null,
          rejectionReason: null,
          workOrderSnapshot: {
            id: workOrder.value.id,
            name: workOrder.value.workOrderNumber,
          },
          contractorSnapshot: workOrder.value.contractorSnapshot,
        };

    if (existing) {
      await this.repositories.contractorQuotes.save(quote);
    } else {
      await this.repositories.contractorQuotes.create(quote);
    }

    return serviceOk(quote);
  }

  async submitContractorQuote(
    input: SubmitContractorQuoteInput,
  ): Promise<ServiceResult<ContractorQuote>> {
    const parsed = submitContractorQuoteSchema.safeParse(input);
    if (!parsed.success) {
      return serviceFail(validationError(parsed.error.issues[0]?.message ?? "Invalid contractor quote submission."));
    }

    const draft = await this.saveContractorQuoteDraft(input);
    if (!draft.ok) {
      return draft;
    }

    if (!canTransitionContractorQuote(draft.value.status, "submitted")) {
      return serviceFail(invalidTransitionError("Contractor quote cannot be submitted from its current state."));
    }

    const submitted: ContractorQuote = touchAuditFields(
      {
        ...draft.value,
        status: "submitted" as const,
        submittedAt: input.now ?? new Date().toISOString(),
      },
      input,
    );

    await this.repositories.contractorQuotes.save(submitted);
    await this.updateWorkOrderStatusIfNeeded(submitted.workOrderId, "quote_received", input);
    await this.dependencies.activityLogs.record({
      ...input,
      workOrderId: submitted.workOrderId,
      action: "contractor_quote.submitted",
      eventType: "contractor_quote_submitted",
      message: "Submitted contractor quote for manager review.",
      entityType: "quote",
      entityId: submitted.id,
      entityLabel: "Contractor quote",
      visibility: "internal",
    });

    const workOrder = await this.repositories.workOrders.getById(submitted.workOrderId);
    const quoteReference = {
      id: submitted.id,
      versionNumber: 1,
    };
    await this.dependencies.notifications?.captureOperationalEvent({
      ...input,
      now: submitted.submittedAt ?? input.now,
      eventType: "quote_submitted",
      entityType: "quote",
      entityId: submitted.id,
      workOrder,
      quote: quoteReference,
      contractorName: submitted.contractorSnapshot?.name ?? null,
      toStatus: submitted.status,
    });
    await this.dependencies.notifications?.captureOperationalEvent({
      ...input,
      now: submitted.submittedAt ?? input.now,
      eventType: "quote_awaiting_manager_review",
      entityType: "quote",
      entityId: submitted.id,
      workOrder,
      quote: quoteReference,
      contractorName: submitted.contractorSnapshot?.name ?? null,
      toStatus: submitted.status,
    });

    return serviceOk(submitted);
  }

  async getQuotesForWorkOrder(
    workOrderId: string,
  ): Promise<ServiceResult<QuoteWorkflowAggregate>> {
    const [contractorQuotes, clientQuotes] = await Promise.all([
      this.repositories.contractorQuotes.listByWorkOrderId(workOrderId),
      this.repositories.clientQuotes.listByWorkOrderId(workOrderId),
    ]);

    return serviceOk({
      contractorQuotes: contractorQuotes.items,
      clientQuotes: clientQuotes.items,
      activeClientQuote: clientQuotes.items.find(
        (quote) => quote.status === "draft" || quote.status === "sent",
      ) ?? null,
    });
  }

  async reviewContractorQuote(
    input: ReviewContractorQuoteInput,
  ): Promise<ServiceResult<ContractorQuote>> {
    const parsed = reviewContractorQuoteSchema.safeParse(input);
    if (!parsed.success) {
      return serviceFail(validationError(parsed.error.issues[0]?.message ?? "Invalid contractor quote review."));
    }

    if (!canReviewContractorQuote(input.actor.role)) {
      return serviceFail(validationError("You do not have permission to review contractor quotes."));
    }

    const quote = await this.repositories.contractorQuotes.getById(input.contractorQuoteId);
    if (!quote || quote.isDeleted || quote.workOrderId !== input.workOrderId) {
      return serviceFail(notFoundError("Contractor quote could not be found for this work order."));
    }

    const nextStatus: ContractorQuoteStatus =
      input.action === "accept_contractor_quote" ? "accepted" : "rejected";

    if (!canTransitionContractorQuote(quote.status, nextStatus)) {
      return serviceFail(invalidTransitionError(`Contractor quote cannot transition from ${quote.status} to ${nextStatus}.`));
    }

    const reviewed = touchAuditFields(
      {
        ...quote,
        status: nextStatus,
        reviewedAt: input.now ?? new Date().toISOString(),
        reviewedByUserId: input.actor.userId,
        rejectionReason:
          nextStatus === "rejected" ? input.rejectionReason?.trim() ?? null : null,
      },
      input,
    );

    await this.repositories.contractorQuotes.save(reviewed);
    if (reviewed.status === "rejected") {
      await this.updateWorkOrderStatusIfNeeded(reviewed.workOrderId, "quote_requested", input);
    }
    await this.dependencies.activityLogs.record({
      ...input,
      workOrderId: reviewed.workOrderId,
      action:
        reviewed.status === "accepted"
          ? "contractor_quote.accepted"
          : "contractor_quote.rejected",
      eventType:
        reviewed.status === "accepted"
          ? "contractor_quote_accepted"
          : "contractor_quote_rejected",
      message:
        reviewed.status === "accepted"
          ? "Accepted contractor quote."
          : "Rejected contractor quote.",
      entityType: "quote",
      entityId: reviewed.id,
      entityLabel: "Contractor quote",
      visibility: "internal",
    });
    return serviceOk(reviewed);
  }

  async createClientQuoteFromContractorQuote(
    input: CreateClientQuoteFromContractorQuoteInput,
  ): Promise<ServiceResult<ClientQuote>> {
    const contractorQuote = await this.repositories.contractorQuotes.getById(
      input.contractorQuoteId,
    );
    if (
      !contractorQuote ||
      contractorQuote.isDeleted ||
      contractorQuote.workOrderId !== input.workOrderId
    ) {
      return serviceFail(notFoundError("Accepted contractor quote could not be found."));
    }

    if (contractorQuote.status !== "accepted") {
      return serviceFail(validationError("Only accepted contractor quotes can generate client quotes."));
    }

    return this.createClientQuoteInternal(input, {
      workOrderId: input.workOrderId,
      sourceContractorQuoteId: contractorQuote.id,
      lineItems: contractorQuote.lineItems,
      subtotal: contractorQuote.subtotal ?? 0,
      taxAmount: contractorQuote.taxAmount,
      totalAmount: contractorQuote.totalAmount,
      notes: input.notes ?? contractorQuote.notes,
    });
  }

  async createManualClientQuote(
    input: CreateManualClientQuoteInput,
  ): Promise<ServiceResult<ClientQuote>> {
    const parsed = createClientQuoteSchema.safeParse(input);
    if (!parsed.success) {
      return serviceFail(validationError(parsed.error.issues[0]?.message ?? "Invalid client quote."));
    }

    return this.createClientQuoteInternal(input, parsed.data);
  }

  async sendClientQuote(
    input: ClientQuoteActionInput,
  ): Promise<ServiceResult<ClientQuote>> {
    const parsed = sendClientQuoteSchema.safeParse(input);
    if (!parsed.success) {
      return serviceFail(validationError(parsed.error.issues[0]?.message ?? "Invalid send client quote request."));
    }

    if (!canManageClientQuote(input.actor.role)) {
      return serviceFail(validationError("You do not have permission to send client quotes."));
    }

    const quote = await this.requireClientQuote(parsed.data.workOrderId, parsed.data.clientQuoteId);
    if (!quote.ok) {
      return quote;
    }

    if (!canTransitionClientQuote(quote.value.status, "sent")) {
      return serviceFail(invalidTransitionError(`Client quote cannot transition from ${quote.value.status} to sent.`));
    }

    const sent: ClientQuote = touchAuditFields(
      {
        ...quote.value,
        status: "sent" as const,
        sentAt: input.now ?? new Date().toISOString(),
      },
      input,
    );

    await this.repositories.clientQuotes.save(sent);
    await this.updateWorkOrderStatusIfNeeded(sent.workOrderId, "pending_client_approval", input);
    await this.dependencies.activityLogs.record({
      ...input,
      workOrderId: sent.workOrderId,
      action: "client_quote.sent",
      eventType: "client_quote_sent",
      message: "Sent client quote for approval.",
      entityType: "quote",
      entityId: sent.id,
      entityLabel: "Client quote",
      visibility: "internal",
    });

    const workOrder = await this.repositories.workOrders.getById(sent.workOrderId);
    await this.dependencies.notifications?.captureOperationalEvent({
      ...input,
      now: sent.sentAt ?? input.now,
      eventType: "quote_awaiting_client_action",
      entityType: "quote",
      entityId: sent.id,
      workOrder,
      quote: {
        id: sent.id,
        versionNumber: 1,
      },
      toStatus: sent.status,
    });

    return serviceOk(sent);
  }

  async approveClientQuote(
    input: ClientQuoteActionInput,
  ): Promise<ServiceResult<ClientQuote>> {
    const parsed = approveClientQuoteSchema.safeParse({
      ...input,
      status: "approved",
    });
    if (!parsed.success) {
      return serviceFail(validationError(parsed.error.issues[0]?.message ?? "Invalid client approval."));
    }

    const quote = await this.requireClientQuote(input.workOrderId, input.clientQuoteId);
    if (!quote.ok) {
      return quote;
    }

    if (!canApproveOrRejectClientQuote(input.actor.role)) {
      return serviceFail(validationError("You do not have permission to approve client quotes."));
    }

    if (quote.value.status !== "sent") {
      return serviceFail(invalidTransitionError("Client quote can only be approved after it has been sent."));
    }

    const approvedAt = input.now ?? new Date().toISOString();
    const approved: ClientQuote = touchAuditFields(
      {
        ...quote.value,
        status: "approved" as const,
        respondedAt: approvedAt,
        approvedAt,
      },
      input,
    );

    await this.repositories.clientQuotes.save(approved);
    await this.updateWorkOrderClientQuotePointer(approved.workOrderId, approved.id, input);
    await this.updateWorkOrderStatusIfNeeded(approved.workOrderId, "approved_to_proceed", input);
    await this.dependencies.activityLogs.record({
      ...input,
      workOrderId: approved.workOrderId,
      action: "client_quote.approved",
      eventType: "client_quote_approved",
      message: "Approved client quote.",
      entityType: "quote",
      entityId: approved.id,
      entityLabel: "Client quote",
      visibility: "internal",
    });
    return serviceOk(approved);
  }

  async rejectClientQuote(
    input: RejectClientQuoteInput,
  ): Promise<ServiceResult<ClientQuote>> {
    const parsed = rejectClientQuoteSchema.safeParse({
      ...input,
      status: "rejected",
    });
    if (!parsed.success) {
      return serviceFail(validationError(parsed.error.issues[0]?.message ?? "Invalid client rejection."));
    }

    const quote = await this.requireClientQuote(input.workOrderId, input.clientQuoteId);
    if (!quote.ok) {
      return quote;
    }

    if (!canApproveOrRejectClientQuote(input.actor.role)) {
      return serviceFail(validationError("You do not have permission to reject client quotes."));
    }

    if (quote.value.status !== "sent") {
      return serviceFail(invalidTransitionError("Client quote can only be rejected after it has been sent."));
    }

    const rejectedAt = input.now ?? new Date().toISOString();
    const rejected: ClientQuote = touchAuditFields(
      {
        ...quote.value,
        status: "rejected" as const,
        respondedAt: rejectedAt,
        rejectedAt,
        rejectionReason: input.rejectionReason.trim(),
      },
      input,
    );

    await this.repositories.clientQuotes.save(rejected);
    await this.updateWorkOrderClientQuotePointer(rejected.workOrderId, rejected.id, input);
    await this.updateWorkOrderStatusIfNeeded(rejected.workOrderId, "quote_requested", input);
    await this.dependencies.activityLogs.record({
      ...input,
      workOrderId: rejected.workOrderId,
      action: "client_quote.rejected",
      eventType: "client_quote_rejected",
      message: "Rejected client quote.",
      entityType: "quote",
      entityId: rejected.id,
      entityLabel: "Client quote",
      visibility: "internal",
    });
    return serviceOk(rejected);
  }

  async getActiveClientQuoteForWorkOrder(
    workOrderId: string,
  ): Promise<ServiceResult<ClientQuote | null>> {
    return serviceOk(await this.repositories.clientQuotes.getActiveByWorkOrderId(workOrderId));
  }

  private async createClientQuoteInternal(
    input: ServiceAuditContext & { workOrderId: string },
    payload: {
      workOrderId: string;
      sourceContractorQuoteId?: string | null;
      lineItems: QuoteLineItem[];
      subtotal: number;
      taxAmount: number;
      totalAmount: number;
      notes?: string | null;
    },
  ): Promise<ServiceResult<ClientQuote>> {
    if (!canManageClientQuote(input.actor.role)) {
      return serviceFail(validationError("You do not have permission to create client quotes."));
    }

    const workOrder = await this.requireWorkOrder(payload.workOrderId);
    if (!workOrder.ok) {
      return workOrder;
    }

    const existingActive = await this.repositories.clientQuotes.getActiveByWorkOrderId(
      payload.workOrderId,
    );
    if (existingActive) {
      return serviceFail(validationError("Only one active client quote is allowed per work order."));
    }

    const quote: ClientQuote = {
      id: this.repositories.clientQuotes.newId(),
      ...createAuditFields(input),
      workOrderId: payload.workOrderId,
      sourceContractorQuoteId: payload.sourceContractorQuoteId ?? null,
      clientOrganizationId: workOrder.value.clientOrganizationId,
      locationId: workOrder.value.locationId,
      lineItems: payload.lineItems,
      subtotal: payload.subtotal,
      taxAmount: payload.taxAmount,
      totalAmount: payload.totalAmount,
      notes: payload.notes ?? null,
      status: "draft",
      sentAt: null,
      respondedAt: null,
      approvedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      createdByUserId: input.actor.userId,
      workOrderSnapshot: {
        id: workOrder.value.id,
        name: workOrder.value.workOrderNumber,
      },
    };

    await this.repositories.clientQuotes.create(quote);
    await this.updateWorkOrderClientQuotePointer(workOrder.value.id, quote.id, input);
    await this.dependencies.activityLogs.record({
      ...input,
      workOrderId: quote.workOrderId,
      action: "client_quote.created",
      eventType: "client_quote_created",
      message: quote.sourceContractorQuoteId
        ? "Created client quote from accepted contractor quote."
        : "Created manual client quote.",
      entityType: "quote",
      entityId: quote.id,
      entityLabel: "Client quote",
      visibility: "internal",
    });
    return serviceOk(quote);
  }

  private async requireClientQuote(
    workOrderId: string,
    clientQuoteId: string,
  ): Promise<ServiceResult<ClientQuote>> {
    const quote = await this.repositories.clientQuotes.getById(clientQuoteId);
    if (!quote || quote.isDeleted || quote.workOrderId !== workOrderId) {
      return serviceFail(notFoundError("Client quote could not be found for this work order."));
    }

    return serviceOk(quote);
  }

  private async requireWorkOrder(workOrderId: string): Promise<ServiceResult<WorkOrder>> {
    const workOrder = await this.repositories.workOrders.getById(workOrderId);
    if (!workOrder || workOrder.isDeleted) {
      return serviceFail(notFoundError("Work order could not be found."));
    }

    return serviceOk(workOrder);
  }

  private async updateWorkOrderClientQuotePointer(
    workOrderId: string,
    clientQuoteId: string,
    input: ServiceAuditContext,
  ): Promise<void> {
    const workOrder = await this.repositories.workOrders.getById(workOrderId);
    if (!workOrder || workOrder.isDeleted) {
      return;
    }

    await this.repositories.workOrders.save(
      touchAuditFields(
        {
          ...workOrder,
          currentQuoteId: clientQuoteId,
        },
        input,
      ),
    );
  }

  private async updateWorkOrderStatusIfNeeded(
    workOrderId: string,
    nextStatus: WorkOrder["status"],
    input: ServiceAuditContext,
  ): Promise<void> {
    const workOrder = await this.repositories.workOrders.getById(workOrderId);
    if (!workOrder || workOrder.isDeleted || workOrder.status === nextStatus) {
      return;
    }

    await this.repositories.workOrders.save(
      touchAuditFields(
        {
          ...workOrder,
          status: nextStatus,
        },
        input,
      ),
    );
  }
}

function canSaveContractorQuoteDraft(role: UserRole | "system"): boolean {
  return (
    role === USER_ROLES.ContractorUser ||
    role === USER_ROLES.Owner
  );
}

function canReviewContractorQuote(role: UserRole | "system"): boolean {
  return (
    role === USER_ROLES.Manager ||
    role === USER_ROLES.Owner
  );
}

function canManageClientQuote(role: UserRole | "system"): boolean {
  return (
    role === USER_ROLES.Manager ||
    role === USER_ROLES.Owner
  );
}

function canApproveOrRejectClientQuote(role: UserRole | "system"): boolean {
  return (
    role === USER_ROLES.ClientUser ||
    role === USER_ROLES.Manager ||
    role === USER_ROLES.Owner
  );
}
