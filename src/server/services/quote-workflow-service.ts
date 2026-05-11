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
import type { DomainEventService } from "./domain-event-service";
import type { NotificationService } from "./notification-service";
import type { WorkOrderService } from "./work-order-service";
import type { AtomicPersistenceContext, AtomicPersistenceService } from "./atomic-persistence-service";
import {
  createAuditFields,
  serviceFail,
  serviceOk,
  touchAuditFields,
  type ServiceResult,
} from "./types";
import type { WorkOrderMutationContext } from "./work-order-mutation-context";

export interface QuoteWorkflowAggregate {
  contractorQuotes: ContractorQuote[];
  clientQuotes: ClientQuote[];
  activeClientQuote: ClientQuote | null;
}

export interface SaveContractorQuoteDraftInput extends WorkOrderMutationContext {
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

export interface ReviewContractorQuoteInput extends WorkOrderMutationContext {
  workOrderId: string;
  contractorQuoteId: string;
  action: "accept_contractor_quote" | "reject_contractor_quote";
  rejectionReason?: string | null;
}

export interface CreateClientQuoteFromContractorQuoteInput extends WorkOrderMutationContext {
  workOrderId: string;
  contractorQuoteId: string;
  notes?: string | null;
}

export interface CreateManualClientQuoteInput extends WorkOrderMutationContext {
  workOrderId: string;
  sourceContractorQuoteId?: string | null;
  lineItems: QuoteLineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string | null;
}

export interface ClientQuoteActionInput extends WorkOrderMutationContext {
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
    domainEvents: DomainEventService;
    workOrders: Pick<
      WorkOrderService,
      "applyQuoteWorkflowPointer" | "applyQuoteWorkflowTransition"
    >;
    notifications?: NotificationService;
    atomicPersistence?: AtomicPersistenceService;
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
    domainEvents: DomainEventService;
    workOrders: Pick<
      WorkOrderService,
      "applyQuoteWorkflowPointer" | "applyQuoteWorkflowTransition"
    >;
    notifications?: NotificationService;
    atomicPersistence?: AtomicPersistenceService;
  };

  constructor(
    repositories: Pick<
      FirestoreRepositories,
      "workOrders" | "contractorQuotes" | "clientQuotes"
    >,
    dependencies: {
      domainEvents: DomainEventService;
      workOrders: Pick<
        WorkOrderService,
        "applyQuoteWorkflowPointer" | "applyQuoteWorkflowTransition"
      >;
      notifications?: NotificationService;
      atomicPersistence?: AtomicPersistenceService;
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

    if (workOrder.value.lifecycleStatus !== "quote_required") {
      return serviceFail(
        validationError("Contractor quotes can only be drafted while the work order is awaiting a quote."),
      );
    }

    if (
      input.actor.role === USER_ROLES.ContractorUser &&
      workOrder.value.assignedContractorOrgId !== input.contractorOrganizationId
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

    const persistSubmission = async (atomic?: AtomicPersistenceContext) => {
      if (atomic) {
        atomic.save("contractorQuotes", submitted);
      } else {
        await this.repositories.contractorQuotes.save(submitted);
      }
      const transition = await this.updateWorkOrderStatusIfNeeded(
        submitted.workOrderId,
        "contractor_quote_received",
        { ...input, atomic },
      );
      if (!transition.ok) {
        return transition;
      }
      await this.dependencies.domainEvents.record({
        ...input,
        atomic,
        workOrderId: submitted.workOrderId,
        type: "contractor_quote_received",
        visibility: "internal",
        lifecycleStatus: "contractor_quote_received",
        entity: {
          entityType: "quote",
          entityId: submitted.id,
          label: "Contractor quote",
        },
        summary: "Submitted contractor quote for manager review.",
        payload: {
          quoteId: submitted.id,
          totalAmount: submitted.totalAmount,
          status: submitted.status,
        },
      });
      return serviceOk(transition.value);
    };

    const transition = this.dependencies.atomicPersistence
      ? await this.dependencies.atomicPersistence.runInTransaction((atomic) =>
          persistSubmission(atomic),
        )
      : await persistSubmission();
    if (!transition.ok) {
      return transition;
    }

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

    const transition = this.dependencies.atomicPersistence
      ? await this.dependencies.atomicPersistence.runInTransaction(async (atomic) => {
          atomic.save("contractorQuotes", reviewed);
          return this.updateWorkOrderStatusIfNeeded(
            reviewed.workOrderId,
            reviewed.status === "accepted" ? "quote_under_review" : "quote_required",
            { ...input, atomic },
          );
        })
      : await (async () => {
          await this.repositories.contractorQuotes.save(reviewed);
          return this.updateWorkOrderStatusIfNeeded(
            reviewed.workOrderId,
            reviewed.status === "accepted" ? "quote_under_review" : "quote_required",
            input,
          );
        })();
    if (!transition.ok) {
      return transition;
    }
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

    const transition = this.dependencies.atomicPersistence
      ? await this.dependencies.atomicPersistence.runInTransaction(async (atomic) => {
          atomic.save("clientQuotes", sent);
          const updated = await this.updateWorkOrderStatusIfNeeded(
            sent.workOrderId,
            "client_approval_requested",
            { ...input, atomic },
          );
          if (!updated.ok) {
            return updated;
          }
          await this.dependencies.domainEvents.record({
            ...input,
            atomic,
            workOrderId: sent.workOrderId,
            type: "client_approval_requested",
            visibility: "client",
            lifecycleStatus: "client_approval_requested",
            entity: {
              entityType: "quote",
              entityId: sent.id,
              label: "Client quote",
            },
            summary: "Sent client quote for approval.",
            payload: {
              quoteId: sent.id,
              totalAmount: sent.totalAmount,
              status: sent.status,
            },
          });
          return updated;
        })
      : await (async () => {
          await this.repositories.clientQuotes.save(sent);
          const updated = await this.updateWorkOrderStatusIfNeeded(
            sent.workOrderId,
            "client_approval_requested",
            input,
          );
          if (!updated.ok) {
            return updated;
          }
          await this.dependencies.domainEvents.record({
            ...input,
            workOrderId: sent.workOrderId,
            type: "client_approval_requested",
            visibility: "client",
            lifecycleStatus: "client_approval_requested",
            entity: {
              entityType: "quote",
              entityId: sent.id,
              label: "Client quote",
            },
            summary: "Sent client quote for approval.",
            payload: {
              quoteId: sent.id,
              totalAmount: sent.totalAmount,
              status: sent.status,
            },
          });
          return updated;
        })();
    if (!transition.ok) {
      return transition;
    }

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

    const transition = this.dependencies.atomicPersistence
      ? await this.dependencies.atomicPersistence.runInTransaction(async (atomic) => {
          atomic.save("clientQuotes", approved);
          const pointerUpdate = await this.dependencies.workOrders.applyQuoteWorkflowPointer({
            ...input,
            atomic,
            source: "quote_workflow",
            workOrderId: approved.workOrderId,
            currentQuoteId: approved.id,
          });
          if (!pointerUpdate.ok) {
            return pointerUpdate;
          }
          const transitioned = await this.dependencies.workOrders.applyQuoteWorkflowTransition(
            {
              ...input,
              atomic,
              source: "quote_workflow",
              workOrderId: approved.workOrderId,
              toStatus: "client_approved",
            },
          );
          if (!transitioned.ok) {
            return transitioned;
          }
          await this.dependencies.domainEvents.record({
            ...input,
            atomic,
            workOrderId: approved.workOrderId,
            type: "client_approved",
            visibility: "client",
            lifecycleStatus: "client_approved",
            entity: {
              entityType: "quote",
              entityId: approved.id,
              label: "Client quote",
            },
            summary: "Approved client quote.",
            payload: {
              quoteId: approved.id,
              status: approved.status,
            },
          });
          return transitioned;
        })
      : await (async () => {
          await this.repositories.clientQuotes.save(approved);
          const pointerUpdate = await this.dependencies.workOrders.applyQuoteWorkflowPointer({
            ...input,
            source: "quote_workflow",
            workOrderId: approved.workOrderId,
            currentQuoteId: approved.id,
          });
          if (!pointerUpdate.ok) {
            return pointerUpdate;
          }
          const transitioned = await this.dependencies.workOrders.applyQuoteWorkflowTransition(
            {
              ...input,
              source: "quote_workflow",
              workOrderId: approved.workOrderId,
              toStatus: "client_approved",
            },
          );
          if (!transitioned.ok) {
            return transitioned;
          }
          await this.dependencies.domainEvents.record({
            ...input,
            workOrderId: approved.workOrderId,
            type: "client_approved",
            visibility: "client",
            lifecycleStatus: "client_approved",
            entity: {
              entityType: "quote",
              entityId: approved.id,
              label: "Client quote",
            },
            summary: "Approved client quote.",
            payload: {
              quoteId: approved.id,
              status: approved.status,
            },
          });
          return transitioned;
        })();
    if (!transition.ok) {
      return transition;
    }
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

    const transition = this.dependencies.atomicPersistence
      ? await this.dependencies.atomicPersistence.runInTransaction(async (atomic) => {
          atomic.save("clientQuotes", rejected);
          const pointerUpdate = await this.dependencies.workOrders.applyQuoteWorkflowPointer({
            ...input,
            atomic,
            source: "quote_workflow",
            workOrderId: rejected.workOrderId,
            currentQuoteId: rejected.id,
          });
          if (!pointerUpdate.ok) {
            return pointerUpdate;
          }
          return this.dependencies.workOrders.applyQuoteWorkflowTransition(
            {
              ...input,
              atomic,
              source: "quote_workflow",
              workOrderId: rejected.workOrderId,
              toStatus: "quote_required",
            },
          );
        })
      : await (async () => {
          await this.repositories.clientQuotes.save(rejected);
          const pointerUpdate = await this.dependencies.workOrders.applyQuoteWorkflowPointer({
            ...input,
            source: "quote_workflow",
            workOrderId: rejected.workOrderId,
            currentQuoteId: rejected.id,
          });
          if (!pointerUpdate.ok) {
            return pointerUpdate;
          }
          return this.dependencies.workOrders.applyQuoteWorkflowTransition(
            {
              ...input,
              source: "quote_workflow",
              workOrderId: rejected.workOrderId,
              toStatus: "quote_required",
            },
          );
        })();
    if (!transition.ok) {
      return transition;
    }
    return serviceOk(rejected);
  }

  async getActiveClientQuoteForWorkOrder(
    workOrderId: string,
  ): Promise<ServiceResult<ClientQuote | null>> {
    return serviceOk(await this.repositories.clientQuotes.getActiveByWorkOrderId(workOrderId));
  }

  private async createClientQuoteInternal(
    input: WorkOrderMutationContext & { workOrderId: string },
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

    const pointerUpdate = this.dependencies.atomicPersistence
      ? await this.dependencies.atomicPersistence.runInTransaction(async (atomic) => {
          atomic.create("clientQuotes", quote);
          return this.dependencies.workOrders.applyQuoteWorkflowPointer({
            ...input,
            atomic,
            source: "quote_workflow",
            workOrderId: workOrder.value.id,
            currentQuoteId: quote.id,
          });
        })
      : await (async () => {
          await this.repositories.clientQuotes.create(quote);
          return this.dependencies.workOrders.applyQuoteWorkflowPointer({
            ...input,
            source: "quote_workflow",
            workOrderId: workOrder.value.id,
            currentQuoteId: quote.id,
          });
        })();
    if (!pointerUpdate.ok) {
      return pointerUpdate;
    }
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

  private async updateWorkOrderStatusIfNeeded(
    workOrderId: string,
    nextStatus: WorkOrder["lifecycleStatus"],
    input: WorkOrderMutationContext,
  ): Promise<ServiceResult<WorkOrder>> {
    return this.dependencies.workOrders.applyQuoteWorkflowTransition({
      ...input,
      source: "quote_workflow",
      workOrderId,
      toStatus: nextStatus,
    });
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
