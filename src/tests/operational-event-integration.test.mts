import assert from "node:assert/strict";
import test from "node:test";

import { createAssignmentService } from "../server/services/assignment-service.ts";
import type {
  RecordDomainEventInput,
  RecordTransitionAuditInput,
} from "../server/services/domain-event-service.ts";
import { createInvoiceService } from "../server/services/invoice-service.ts";
import { createQuoteWorkflowService } from "../server/services/quote-workflow-service.ts";
import { createWorkOrderService } from "../server/services/work-order-service.ts";
import type {
  DomainEvent,
  DomainEventType,
  TransitionAudit,
  TransitionEvent,
} from "../server/events/types.ts";
import type {
  Assignment,
  AssignmentRepository,
  ClientInvoice,
  ClientInvoiceRepository,
  ClientQuote,
  ClientQuoteRepository,
  ContractorOrganization,
  ContractorOrganizationRepository,
  ContractorQuote,
  ContractorQuoteRepository,
  DomainEventRepository,
  FirestoreRepositories,
  Location,
  TransitionAuditRepository,
  TransitionEventRepository,
  WorkOrder,
  WorkOrderRepository,
} from "../server/repositories/index.ts";
import type { DomainEventService } from "../server/services/domain-event-service.ts";
import type { ClientLocationService } from "../server/services/client-location-service.ts";
import { USER_ROLES } from "../types/permissions.ts";

test("work order lifecycle transition writes transition and specific lifecycle events", async () => {
  const harness = createWorkflowHarness();
  const service = createWorkOrderService(harness.repositories, {
    domainEvents: harness.domainEventsService,
    clientLocations: {
      async getClientLocationContext() {
        return {
          ok: true,
          value: {
            client: await harness.repositories.clientOrganizations.getById("client-org-1"),
            location: await harness.repositories.locations.getById("loc-1"),
          },
        };
      },
    } as unknown as ClientLocationService,
  });

  const result = await service.transition({
    organizationId: "org-1",
    actor: { userId: "user-1", role: USER_ROLES.Manager },
    workOrderId: "wo-1",
    toStatus: "on_hold",
  });

  assert.equal(result.ok, true);
  assert.equal(harness.transitionAudits.length, 1);
  assert.equal(harness.transitionEvents.length, 1);
  assert.equal(harness.domainEvents.at(-1)?.type, "work_order_on_hold");
});

test("assignment, quote, and invoice workflows emit canonical events", async () => {
  const harness = createWorkflowHarness();
  const assignmentService = createAssignmentService(harness.repositories, {
    domainEvents: harness.domainEventsService,
  });
  const quoteService = createQuoteWorkflowService(harness.repositories, {
    domainEvents: harness.domainEventsService,
  });
  const invoiceService = createInvoiceService(harness.repositories, {
    domainEvents: harness.domainEventsService,
  });

  const assignment = await assignmentService.assignContractor({
    organizationId: "org-1",
    actor: { userId: "user-1", role: USER_ROLES.Coordinator },
    workOrderId: "wo-1",
    contractorOrganizationId: "contractor-1",
  });
  assert.equal(assignment.ok, true);

  const accepted = await assignmentService.updateStatus({
    organizationId: "org-1",
    actor: { userId: "contractor-user-1", role: USER_ROLES.ContractorUser },
    workOrderId: "wo-1",
    assignmentId: assignment.value.id,
    status: "accepted",
  });
  assert.equal(accepted.ok, true);

  const submitted = await quoteService.submitContractorQuote({
    organizationId: "org-1",
    actor: { userId: "contractor-user-1", role: USER_ROLES.ContractorUser },
    workOrderId: "wo-1",
    contractorOrganizationId: "contractor-1",
    contractorUserId: "contractor-user-1",
    lineItems: [{ description: "Repair", quantity: 1, unitPrice: 100, lineTotal: 100 }],
    subtotal: 100,
    taxAmount: 13,
    totalAmount: 113,
  });
  assert.equal(submitted.ok, true);

  harness.clientQuoteStore.set("client-quote-1", makeClientQuote());
  const sent = await quoteService.sendClientQuote({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: USER_ROLES.Manager },
    workOrderId: "wo-1",
    clientQuoteId: "client-quote-1",
  });
  assert.equal(sent.ok, true);

  const approved = await quoteService.approveClientQuote({
    organizationId: "org-1",
    actor: { userId: "client-1", role: USER_ROLES.ClientUser },
    workOrderId: "wo-1",
    clientQuoteId: "client-quote-1",
  });
  assert.equal(approved.ok, true);

  harness.invoiceStore.set("invoice-1", makeInvoice());
  harness.workOrderStore.set("wo-1", {
    ...harness.workOrderStore.get("wo-1")!,
    currentInvoiceId: "invoice-1",
    lifecycleStatus: "ready_for_invoicing",
  });
  const invoiceSent = await invoiceService.sendInvoice({
    organizationId: "org-1",
    actor: { userId: "finance-1", role: USER_ROLES.FinanceAdmin },
    workOrderId: "wo-1",
    invoiceId: "invoice-1",
  });
  assert.equal(invoiceSent.ok, true, invoiceSent.ok ? "" : invoiceSent.error.message);

  const payment = await invoiceService.markInvoicePaid({
    organizationId: "org-1",
    actor: { userId: "finance-1", role: USER_ROLES.FinanceAdmin },
    workOrderId: "wo-1",
    invoiceId: "invoice-1",
    paymentReference: "pm-123",
  });
  assert.equal(payment.ok, true);

  assert.deepEqual(
    harness.domainEvents.map((event) => event.type),
    [
      "assignment_created",
      "contractor_contacted",
      "assignment_accepted",
      "lifecycle_transitioned",
      "contractor_quote_received",
      "lifecycle_transitioned",
      "client_approval_requested",
      "lifecycle_transitioned",
      "client_approved",
      "lifecycle_transitioned",
      "invoice_sent",
      "lifecycle_transitioned",
      "payment_recorded",
    ],
  );
});

function createWorkflowHarness() {
  const domainEvents: DomainEvent[] = [];
  const transitionEvents: TransitionEvent[] = [];
  const transitionAudits: TransitionAudit[] = [];
  const workOrderStore = new Map<string, WorkOrder>([["wo-1", makeWorkOrder()]]);
  const assignmentStore = new Map<string, Assignment>();
  const contractorQuoteStore = new Map<string, ContractorQuote>();
  const clientQuoteStore = new Map<string, ClientQuote>();
  const invoiceStore = new Map<string, ClientInvoice>();
  const contractorStore = new Map<string, ContractorOrganization>([
    ["contractor-1", makeContractor()],
  ]);
  const eventHarness = createEventHarness(domainEvents, transitionEvents, transitionAudits);

  const repositories: Pick<
    FirestoreRepositories,
    | "assignments"
    | "clientInvoices"
    | "clientOrganizations"
    | "clientQuotes"
    | "contractorOrganizations"
    | "contractorQuotes"
    | "domainEvents"
    | "locations"
    | "transitionAudits"
    | "transitionEvents"
    | "userProfiles"
    | "workOrders"
  > = {
    domainEvents: eventHarness.domainEventRepository,
    transitionEvents: eventHarness.transitionEventRepository,
    transitionAudits: eventHarness.transitionAuditRepository,
    workOrders: makeWorkOrderRepository(workOrderStore),
    assignments: makeAssignmentRepository(assignmentStore),
    contractorOrganizations: makeContractorRepository(contractorStore),
    userProfiles: {
      newId: () => "user-1",
      async getById(id) {
        if (id === "contractor-user-1") {
          return {
            id,
            organizationId: "org-1",
            recordStatus: "active",
            isDeleted: false,
            createdAt: now(),
            updatedAt: now(),
            createdByUserId: "user-1",
            updatedByUserId: "user-1",
            deletedAt: null,
            deletedByUserId: null,
            email: "contractor@example.com",
            displayName: "Contractor User",
            role: USER_ROLES.ContractorUser,
            status: "active",
            clientOrganizationId: null,
            contractorOrganizationId: "contractor-1",
            locationIds: [],
            lastLoginAt: null,
          };
        }
        return null;
      },
      async create(entity) { return { id: entity.id, item: entity }; },
      async save(entity) { return { id: entity.id, item: entity }; },
      async getByEmail() { return null; },
      async listByOrganizationId() { return { items: [], count: 0 }; },
      async listByContractorOrganizationId() { return { items: [], count: 0 }; },
    },
    contractorQuotes: makeContractorQuoteRepository(contractorQuoteStore),
    clientQuotes: makeClientQuoteRepository(clientQuoteStore),
    clientInvoices: makeInvoiceRepository(invoiceStore),
    clientOrganizations: {
      newId: () => "client-org-1",
      async getById() { return { id: "client-org-1", organizationId: "org-1", recordStatus: "active", isDeleted: false, createdAt: now(), updatedAt: now(), createdByUserId: "user-1", updatedByUserId: "user-1", name: "Client", displayName: "Client", status: "active", notes: null, primaryContactId: null, billingContactId: null }; },
      async create(entity) { return { id: entity.id, item: entity }; },
      async save(entity) { return { id: entity.id, item: entity }; },
      async listByOrganizationId() { return { items: [], count: 0 }; },
      async listActive() { return { items: [], count: 0 }; },
    },
    locations: {
      newId: () => "loc-1",
      async getById() { return makeLocation(); },
      async create(entity) { return { id: entity.id, item: entity }; },
      async save(entity) { return { id: entity.id, item: entity }; },
      async listByOrganizationId() { return { items: [], count: 0 }; },
      async listByClientOrganizationId() { return { items: [], count: 0 }; },
    },
  };

  return {
    repositories,
    domainEventsService: createDomainEventServiceLike(eventHarness),
    domainEvents,
    transitionEvents,
    transitionAudits,
    workOrderStore,
    clientQuoteStore,
    invoiceStore,
  };
}

function createEventHarness(
  domainEvents: DomainEvent[],
  transitionEvents: TransitionEvent[],
  transitionAudits: TransitionAudit[],
) {
  const domainEventRepository: DomainEventRepository = {
    newId: () => `evt-${domainEvents.length + 1}`,
    async getById(id) { return domainEvents.find((event) => event.id === id) ?? null; },
    async create(entity) { domainEvents.push(entity); return { id: entity.id, item: entity }; },
    async save(entity) { return { id: entity.id, item: entity }; },
    async listByOrganizationId(organizationId) {
      return {
        items: domainEvents.filter((event) => event.organizationId === organizationId),
        count: domainEvents.length,
      };
    },
    async listByWorkOrderId(workOrderId) { return { items: domainEvents.filter((event) => event.workOrderId === workOrderId), count: domainEvents.length }; },
    async listByEntity(entity) {
      const items = domainEvents.filter((event) =>
        event.entity.entityType === entity.entityType &&
        event.entity.entityId === entity.entityId
      );
      return { items, count: items.length };
    },
  };
  const transitionEventRepository: TransitionEventRepository = {
    newId: () => `te-${transitionEvents.length + 1}`,
    async getById(id) { return transitionEvents.find((event) => event.id === id) ?? null; },
    async create(entity) { transitionEvents.push(entity); return { id: entity.id, item: entity }; },
    async save(entity) { return { id: entity.id, item: entity }; },
    async listByWorkOrderId(workOrderId) { return { items: transitionEvents.filter((event) => event.workOrderId === workOrderId), count: transitionEvents.length }; },
  };
  const transitionAuditRepository: TransitionAuditRepository = {
    newId: () => `ta-${transitionAudits.length + 1}`,
    async getById(id) { return transitionAudits.find((audit) => audit.id === id) ?? null; },
    async create(entity) { transitionAudits.push(entity); return { id: entity.id, item: entity }; },
    async save(entity) { return { id: entity.id, item: entity }; },
    async listByWorkOrderId(workOrderId) { return { items: transitionAudits.filter((audit) => audit.workOrderId === workOrderId), count: transitionAudits.length }; },
  };
  return { domainEventRepository, transitionEventRepository, transitionAuditRepository, domainEvents, transitionEvents, transitionAudits };
}

function createDomainEventServiceLike(input: ReturnType<typeof createEventHarness>): DomainEventService {
  return {
    async record<TType extends DomainEventType>(payload: RecordDomainEventInput<TType>) {
      const event = { id: input.domainEventRepository.newId(), organizationId: payload.organizationId, tenantId: payload.organizationId, workOrderId: payload.workOrderId, type: payload.type, actor: { actorId: payload.actor.userId, actorType: "user", actorRole: payload.actor.role, displayName: null }, visibility: payload.visibility, occurredAt: payload.now ?? now(), lifecycleStatus: payload.lifecycleStatus, entity: payload.entity, summary: payload.summary, metadata: { requestId: payload.requestId ?? null, reason: payload.reason ?? null, correlationId: payload.correlationId ?? null, details: {} }, payload: payload.payload };
      await input.domainEventRepository.create(event as DomainEvent<TType>);
      return { ok: true as const, value: event as DomainEvent<TType> };
    },
    async recordTransition(payload: RecordTransitionAuditInput) {
      const occurredAt = payload.now ?? now();
      const transitionEvent = { id: input.transitionEventRepository.newId(), organizationId: payload.organizationId, tenantId: payload.organizationId, workOrderId: payload.workOrderId, actor: { actorId: payload.actor.userId, actorType: "user", actorRole: payload.actor.role, displayName: null }, visibility: payload.visibility, occurredAt, fromLifecycleStatus: payload.fromLifecycleStatus, toLifecycleStatus: payload.toLifecycleStatus, reason: payload.reason ?? null, metadata: { requestId: payload.requestId ?? null, reason: payload.reason ?? null, correlationId: null, details: payload.metadata ?? {} } };
      const transitionAudit = { id: input.transitionAuditRepository.newId(), organizationId: payload.organizationId, tenantId: payload.organizationId, workOrderId: payload.workOrderId, actor: transitionEvent.actor, occurredAt, fromLifecycleStatus: payload.fromLifecycleStatus, toLifecycleStatus: payload.toLifecycleStatus, reason: payload.reason ?? null, metadata: transitionEvent.metadata, escalationContext: payload.escalationContext ?? null, holdContext: payload.holdContext ?? null };
      await input.transitionEventRepository.create(transitionEvent as TransitionEvent);
      await input.transitionAuditRepository.create(transitionAudit as TransitionAudit);
      const domainEvent = { id: input.domainEventRepository.newId(), organizationId: payload.organizationId, tenantId: payload.organizationId, workOrderId: payload.workOrderId, type: "lifecycle_transitioned", actor: transitionEvent.actor, visibility: payload.visibility, occurredAt, lifecycleStatus: payload.toLifecycleStatus, entity: { entityType: "work_order", entityId: payload.workOrderId, label: null }, summary: `Lifecycle transitioned from ${payload.fromLifecycleStatus} to ${payload.toLifecycleStatus}.`, metadata: transitionEvent.metadata, payload: { fromLifecycleStatus: payload.fromLifecycleStatus, toLifecycleStatus: payload.toLifecycleStatus, reason: payload.reason ?? null } };
      await input.domainEventRepository.create(domainEvent as DomainEvent<"lifecycle_transitioned">);
      return {
        ok: true as const,
        value: {
          domainEvent: domainEvent as DomainEvent<"lifecycle_transitioned">,
          transitionEvent: transitionEvent as TransitionEvent,
          transitionAudit: transitionAudit as TransitionAudit,
        },
      };
    },
    async listTimelineForWorkOrder() {
      return { ok: true, value: [] };
    },
    async listTimelineForEntity() {
      return { ok: true, value: [] };
    },
  };
}

function makeWorkOrderRepository(store: Map<string, WorkOrder>): WorkOrderRepository {
  return {
    newId: () => "wo-1",
    async getById(id) { return store.get(id) ?? null; },
    async create(entity) { store.set(entity.id, entity); return { id: entity.id, item: entity }; },
    async save(entity) { store.set(entity.id, entity); return { id: entity.id, item: entity }; },
    async listByOrganizationId() { return { items: [...store.values()], count: store.size }; },
    async listByClientOrganizationId() { return { items: [...store.values()], count: store.size }; },
    async listByLocationId() { return { items: [...store.values()], count: store.size }; },
    async listByCoordinatorUserId() { return { items: [], count: 0 }; },
    async listByManagerUserId() { return { items: [], count: 0 }; },
    async listByContractorOrganizationId(contractorOrganizationId) { return { items: [...store.values()].filter((item) => item.assignedContractorOrgId === contractorOrganizationId), count: store.size }; },
  };
}

function makeAssignmentRepository(store: Map<string, Assignment>): AssignmentRepository {
  return {
    newId: () => `assignment-${store.size + 1}`,
    async getById(id) { return store.get(id) ?? null; },
    async create(entity) { store.set(entity.id, entity); return { id: entity.id, item: entity }; },
    async save(entity) { store.set(entity.id, entity); return { id: entity.id, item: entity }; },
    async listByWorkOrderId(workOrderId) { return { items: [...store.values()].filter((item) => item.workOrderId === workOrderId), count: store.size }; },
    async getActiveByWorkOrderId(workOrderId) { return [...store.values()].find((item) => item.workOrderId === workOrderId && (item.status === "assigned" || item.status === "accepted")) ?? null; },
    async listByContractorOrganizationId(contractorOrganizationId) { return { items: [...store.values()].filter((item) => item.contractorOrganizationId === contractorOrganizationId), count: store.size }; },
  };
}

function makeContractorRepository(store: Map<string, ContractorOrganization>): ContractorOrganizationRepository {
  return {
    newId: () => "contractor-1",
    async getById(id) { return store.get(id) ?? null; },
    async create(entity) { store.set(entity.id, entity); return { id: entity.id, item: entity }; },
    async save(entity) { store.set(entity.id, entity); return { id: entity.id, item: entity }; },
    async listByOrganizationId() { return { items: [...store.values()], count: store.size }; },
    async listActive() { return { items: [...store.values()], count: store.size }; },
  };
}

function makeContractorQuoteRepository(store: Map<string, ContractorQuote>): ContractorQuoteRepository {
  return {
    newId: () => `contractor-quote-${store.size + 1}`,
    async getById(id) { return store.get(id) ?? null; },
    async create(entity) { store.set(entity.id, entity); return { id: entity.id, item: entity }; },
    async save(entity) { store.set(entity.id, entity); return { id: entity.id, item: entity }; },
    async listByWorkOrderId(workOrderId) { return { items: [...store.values()].filter((item) => item.workOrderId === workOrderId), count: store.size }; },
    async listPendingReview() { return { items: [], count: 0 }; },
  };
}

function makeClientQuoteRepository(store: Map<string, ClientQuote>): ClientQuoteRepository {
  return {
    newId: () => "client-quote-1",
    async getById(id) { return store.get(id) ?? null; },
    async create(entity) { store.set(entity.id, entity); return { id: entity.id, item: entity }; },
    async save(entity) { store.set(entity.id, entity); return { id: entity.id, item: entity }; },
    async listByWorkOrderId(workOrderId) { return { items: [...store.values()].filter((item) => item.workOrderId === workOrderId), count: store.size }; },
    async getActiveByWorkOrderId(workOrderId) { return [...store.values()].find((item) => item.workOrderId === workOrderId && (item.status === "draft" || item.status === "sent")) ?? null; },
  };
}

function makeInvoiceRepository(store: Map<string, ClientInvoice>): ClientInvoiceRepository {
  return {
    newId: () => "invoice-1",
    async getById(id) { return store.get(id) ?? null; },
    async create(entity) { store.set(entity.id, entity); return { id: entity.id, item: entity }; },
    async save(entity) { store.set(entity.id, entity); return { id: entity.id, item: entity }; },
    async listByWorkOrderId(workOrderId) { return { items: [...store.values()].filter((item) => item.workOrderId === workOrderId), count: store.size }; },
    async listFinanceQueue() { return { items: [...store.values()], count: store.size }; },
  };
}

function makeWorkOrder(): WorkOrder {
  return {
    id: "wo-1",
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: now(),
    updatedAt: now(),
    createdByUserId: "user-1",
    updatedByUserId: "user-1",
    deletedAt: null,
    deletedByUserId: null,
    workOrderNumber: "WO-1",
    title: "Broken faucet",
    description: "Repair sink",
    poNumber: null,
    requestedByName: null,
    requestedByEmail: null,
    requestedByPhone: null,
    requestedServiceDate: null,
    dueDate: null,
    category: "plumbing",
    requiresQuote: true,
    quoteRequiredThresholdCents: null,
    lifecycleStatus: "quote_required",
    status: "quote_required",
    assignmentStatus: null,
    quoteSummaryStatus: "awaiting_contractor_quote",
    invoiceSummaryStatus: "not_ready",
    approvalStatus: "not_required",
    priority: "medium",
    clientOrganizationId: "client-org-1",
    locationId: "loc-1",
    requestedByContactId: null,
    siteContactId: null,
    coordinatorUserId: null,
    managerUserId: null,
    assignedCoordinatorUserId: null,
    assignedManagerUserId: null,
    assignedContractorOrgId: "contractor-1",
    assignedContractorContactId: null,
    financeOwnerUserId: null,
    quoteReviewerUserId: null,
    currentQuoteId: null,
    currentInvoiceId: null,
    currentQuoteVersionNumber: null,
    invoiceNumber: null,
    clientSnapshot: { id: "client-org-1", name: "Client" },
    locationSnapshot: { id: "loc-1", name: "Store 1", addressText: "123 Main" },
    contractorSnapshot: { id: "contractor-1", name: "Vendor 1" },
    lastActivityAt: now(),
    nextActionOwnerType: null,
    nextActionDueAt: null,
    isEscalated: false,
    escalationReason: null,
    holdReason: null,
    previousLifecycleStatus: null,
    intakeReceivedAt: now(),
    triagedAt: null,
    assignedAt: now(),
    contractorContactedAt: null,
    contractorRespondedAt: null,
    contractorScheduledAt: null,
    workStartedAt: null,
    quoteRequestedAt: now(),
    contractorQuoteReceivedAt: null,
    quoteReviewStartedAt: null,
    clientApprovalRequestedAt: null,
    clientApprovedAt: null,
    workCompletedAt: null,
    completionReviewStartedAt: null,
    readyForInvoicingAt: null,
    invoiceSentAt: null,
    paidAt: null,
    closedAt: null,
    cancelledAt: null,
    holdStartedAt: null,
    escalatedAt: null,
  };
}

function makeContractor(): ContractorOrganization {
  return {
    id: "contractor-1",
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: now(),
    updatedAt: now(),
    createdByUserId: "user-1",
    updatedByUserId: "user-1",
    deletedAt: null,
    deletedByUserId: null,
    name: "Vendor 1",
    displayName: "Vendor 1",
    parentContractorId: null,
    status: "active",
    isAssignable: true,
    primaryContactId: null,
    billingContactId: null,
    dispatchContactId: null,
    businessEmail: null,
    mainPhone: null,
    altPhone: null,
    fax: null,
    trades: ["plumbing"],
    serviceArea: null,
    ratingSummary: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    region: null,
    postalCode: null,
    countryCode: null,
    notes: null,
  };
}

function makeClientQuote(): ClientQuote {
  return {
    id: "client-quote-1",
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: now(),
    updatedAt: now(),
    createdByUserId: "manager-1",
    updatedByUserId: "manager-1",
    deletedAt: null,
    deletedByUserId: null,
    workOrderId: "wo-1",
    sourceContractorQuoteId: "contractor-quote-1",
    clientOrganizationId: "client-org-1",
    locationId: "loc-1",
    lineItems: [{ description: "Repair", quantity: 1, unitPrice: 100, lineTotal: 100 }],
    subtotal: 100,
    taxAmount: 13,
    totalAmount: 113,
    notes: null,
    status: "draft",
    sentAt: null,
    respondedAt: null,
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    workOrderSnapshot: { id: "wo-1", name: "WO-1" },
  };
}

function makeInvoice(): ClientInvoice {
  return {
    id: "invoice-1",
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: now(),
    updatedAt: now(),
    createdByUserId: "finance-1",
    updatedByUserId: "finance-1",
    deletedAt: null,
    deletedByUserId: null,
    workOrderId: "wo-1",
    clientOrganizationId: "client-org-1",
    locationId: "loc-1",
    invoiceNumber: "INV-1",
    lineItems: [{ id: "line-1", description: "Repair", quantity: 1, unitPrice: 100, lineTotal: 100 }],
    subtotal: 100,
    taxAmount: 13,
    totalAmount: 113,
    currency: "CAD",
    status: "draft",
    issuedDate: null,
    dueDate: "2026-05-10T12:00:00.000Z",
    sentAt: null,
    viewedAt: null,
    paidAt: null,
    voidedAt: null,
    paymentReference: null,
    notes: null,
    qboInvoiceId: null,
    qboSyncStatus: null,
    workOrderSnapshot: { id: "wo-1", name: "WO-1" },
    clientSnapshot: { id: "client-org-1", name: "Client" },
    locationSnapshot: { id: "loc-1", name: "Store 1" },
  };
}

function makeLocation(): Location {
  return {
    id: "loc-1",
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: now(),
    updatedAt: now(),
    createdByUserId: "user-1",
    updatedByUserId: "user-1",
    deletedAt: null,
    deletedByUserId: null,
    clientOrganizationId: "client-org-1",
    name: "Store 1",
    displayName: "Store 1",
    code: "001",
    storeNumber: "001",
    status: "active",
    primaryContactId: null,
    siteContactId: null,
    addressLine1: "123 Main",
    addressLine2: null,
    city: "Toronto",
    region: "ON",
    postalCode: "M5V",
    countryCode: "CA",
    latitude: null,
    longitude: null,
    timeZone: "America/Toronto",
    accessNotes: null,
    serviceNotes: null,
    notes: null,
  };
}

function now() {
  return "2026-05-06T12:00:00.000Z";
}
