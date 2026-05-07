import assert from "node:assert/strict";
import test from "node:test";

import { createCommunicationServices } from "../server/services/communication-service.ts";
import type { DomainEvent, DomainEventType } from "../server/events/types.ts";
import type {
  RecordDomainEventInput,
  RecordTransitionAuditInput,
} from "../server/services/domain-event-service.ts";
import type {
  CommunicationAttachment,
  CommunicationLink,
  CommunicationMatchSuggestion,
  CommunicationMessage,
  CommunicationParticipant,
  CommunicationThread,
} from "../modules/communications/index.ts";
import type {
  CommunicationAttachmentRepository,
  CommunicationLinkRepository,
  CommunicationMatchSuggestionRepository,
  CommunicationMessageRepository,
  CommunicationParticipantRepository,
  CommunicationThreadRepository,
  WorkOrder,
  WorkOrderRepository,
} from "../server/repositories/index.ts";
import { USER_ROLES } from "../types/permissions.ts";

test("internal note creation writes canonical thread, message, participant, and events", async () => {
  const harness = createHarness();
  const services = createCommunicationServices(harness.repositories, {
    domainEvents: harness.domainEventsService,
  });

  const result = await services.messages.createInternalNote({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: USER_ROLES.Manager },
    workOrderId: "wo-1",
    body: "Dispatch called site contact.",
  });

  assert.equal(result.ok, true);
  assert.equal(harness.threads.length, 1);
  assert.equal(harness.messages.length, 1);
  assert.equal(harness.participants.length, 1);
  assert.equal(harness.links.length, 1);
  assert.deepEqual(
    harness.domainEvents.map((event) => event.type),
    ["communication_thread_created", "communication_message_created"],
  );
});

test("communication query filters client and contractor visibility safely", async () => {
  const harness = createHarness();
  harness.messages.push(
    makeMessage({
      id: "msg-internal",
      visibility: ["internal"],
      body: "Internal only",
      createdAt: "2026-05-06T10:00:00.000Z",
    }),
    makeMessage({
      id: "msg-client",
      visibility: ["client"],
      body: "Client visible",
      createdAt: "2026-05-06T11:00:00.000Z",
    }),
    makeMessage({
      id: "msg-contractor",
      visibility: ["contractor"],
      body: "Contractor visible",
      createdAt: "2026-05-06T12:00:00.000Z",
    }),
  );

  const services = createCommunicationServices(harness.repositories, {
    domainEvents: harness.domainEventsService,
  });

  const clientTimeline = await services.query.listTimelineForWorkOrder("wo-1", {
    actorType: "client",
    userId: "client-1",
    role: USER_ROLES.ClientUser,
    scope: {
      kind: "client",
      organizationId: "org-1",
      clientOrganizationId: "client-org-1",
      locationAccess: { kind: "all_client_locations" },
    },
  });
  const contractorTimeline = await services.query.listTimelineForWorkOrder("wo-1", {
    actorType: "contractor",
    userId: "contractor-1",
    role: USER_ROLES.ContractorUser,
    scope: {
      kind: "contractor",
      organizationId: "org-1",
      contractorOrganizationId: "contractor-org-1",
    },
  });

  assert.equal(clientTimeline.ok, true);
  assert.deepEqual(clientTimeline.value.map((item) => item.id), ["msg-client"]);
  assert.equal(contractorTimeline.ok, true);
  assert.deepEqual(contractorTimeline.value.map((item) => item.id), ["msg-contractor"]);
});

test("message linking and attachment mirroring create canonical records", async () => {
  const harness = createHarness();
  const services = createCommunicationServices(harness.repositories, {
    domainEvents: harness.domainEventsService,
  });

  const message = await services.messages.create({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: USER_ROLES.Manager },
    workOrderId: "wo-1",
    channel: "portal_message",
    direction: "outbound",
    visibility: ["client"],
    body: "Quote is ready for review.",
    linkedEntities: [
      {
        entityType: "quote",
        entityId: "quote-1",
        relationshipType: "related",
      },
    ],
  });
  assert.equal(message.ok, true);
  assert.equal(harness.links.length, 2);
  assert.equal(
    harness.domainEvents.some((event) => event.type === "communication_message_linked"),
    true,
  );

  const attachment = await services.messages.recordAttachment({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: USER_ROLES.Manager },
    workOrderId: "wo-1",
    fileName: "photo.jpg",
    contentType: "image/jpeg",
    sizeBytes: 1024,
    storagePath: "work-orders/wo-1/photo.jpg",
    visibility: ["internal"],
  });
  assert.equal(attachment.ok, true);
  assert.equal(harness.attachments.length, 1);
});

test("tenant-safe write rejects work orders outside the caller organization", async () => {
  const harness = createHarness();
  harness.workOrders.set("wo-2", {
    ...makeWorkOrder(),
    id: "wo-2",
    organizationId: "org-2",
  });
  const services = createCommunicationServices(harness.repositories, {
    domainEvents: harness.domainEventsService,
  });

  const result = await services.messages.createInternalNote({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: USER_ROLES.Manager },
    workOrderId: "wo-2",
    body: "This should fail.",
  });

  assert.equal(result.ok, false);
});

function createHarness() {
  const threads: CommunicationThread[] = [];
  const messages: CommunicationMessage[] = [];
  const participants: CommunicationParticipant[] = [];
  const links: CommunicationLink[] = [];
  const attachments: CommunicationAttachment[] = [];
  const matchSuggestions: CommunicationMatchSuggestion[] = [];
  const domainEvents: DomainEvent[] = [];
  const workOrders = new Map<string, WorkOrder>([["wo-1", makeWorkOrder()]]);

  const repositories: {
    communicationAttachments: CommunicationAttachmentRepository;
    communicationLinks: CommunicationLinkRepository;
    communicationMatchSuggestions: CommunicationMatchSuggestionRepository;
    communicationMessages: CommunicationMessageRepository;
    communicationParticipants: CommunicationParticipantRepository;
    communicationThreads: CommunicationThreadRepository;
    workOrders: WorkOrderRepository;
  } = {
    communicationThreads: {
      newId: () => `thread-${threads.length + 1}`,
      async getById(id) { return threads.find((item) => item.id === id) ?? null; },
      async create(entity) { threads.push(entity); return { id: entity.id, item: entity }; },
      async save(entity) {
        const index = threads.findIndex((item) => item.id === entity.id);
        if (index >= 0) {
          threads[index] = entity;
        } else {
          threads.push(entity);
        }
        return { id: entity.id, item: entity };
      },
      async listByWorkOrderId(workOrderId) {
        const items = threads.filter((item) => item.workOrderId === workOrderId);
        return { items, count: items.length };
      },
      async findByWorkOrderChannelVisibility(input) {
        return (
          threads.find((item) =>
            item.workOrderId === input.workOrderId &&
            item.channel === input.channel &&
            item.visibility.slice().sort().join("|") === input.visibility.slice().sort().join("|"),
          ) ?? null
        );
      },
    },
    communicationMessages: {
      newId: () => `message-${messages.length + 1}`,
      async getById(id) { return messages.find((item) => item.id === id) ?? null; },
      async create(entity) { messages.push(entity); return { id: entity.id, item: entity }; },
      async save(entity) { return { id: entity.id, item: entity }; },
      async listByThreadId(threadId) {
        const items = messages.filter((item) => item.threadId === threadId);
        return { items, count: items.length };
      },
      async listByWorkOrderId(workOrderId) {
        const items = messages.filter((item) => item.workOrderId === workOrderId);
        return { items, count: items.length };
      },
    },
    communicationParticipants: {
      newId: () => `participant-${participants.length + 1}`,
      async getById(id) { return participants.find((item) => item.id === id) ?? null; },
      async create(entity) { participants.push(entity); return { id: entity.id, item: entity }; },
      async save(entity) { return { id: entity.id, item: entity }; },
      async listByThreadId(threadId) {
        const items = participants.filter((item) => item.threadId === threadId);
        return { items, count: items.length };
      },
    },
    communicationLinks: {
      newId: () => `link-${links.length + 1}`,
      async getById(id) { return links.find((item) => item.id === id) ?? null; },
      async create(entity) { links.push(entity); return { id: entity.id, item: entity }; },
      async save(entity) { return { id: entity.id, item: entity }; },
      async listByMessageId(messageId) {
        const items = links.filter((item) => item.messageId === messageId);
        return { items, count: items.length };
      },
      async listByWorkOrderId(workOrderId) {
        const items = links.filter((item) => item.workOrderId === workOrderId);
        return { items, count: items.length };
      },
    },
    communicationAttachments: {
      newId: () => `attachment-${attachments.length + 1}`,
      async getById(id) { return attachments.find((item) => item.id === id) ?? null; },
      async create(entity) { attachments.push(entity); return { id: entity.id, item: entity }; },
      async save(entity) { return { id: entity.id, item: entity }; },
      async listByMessageId(messageId) {
        const items = attachments.filter((item) => item.messageId === messageId);
        return { items, count: items.length };
      },
      async listByWorkOrderId(workOrderId) {
        const items = attachments.filter((item) => item.workOrderId === workOrderId);
        return { items, count: items.length };
      },
    },
    communicationMatchSuggestions: {
      newId: () => `suggestion-${matchSuggestions.length + 1}`,
      async getById(id) { return matchSuggestions.find((item) => item.id === id) ?? null; },
      async create(entity) {
        matchSuggestions.push(entity);
        return { id: entity.id, item: entity };
      },
      async save(entity) { return { id: entity.id, item: entity }; },
      async listByWorkOrderId(workOrderId) {
        const items = matchSuggestions.filter((item) => item.workOrderId === workOrderId);
        return { items, count: items.length };
      },
      async listPendingReview(organizationId) {
        const items = matchSuggestions.filter(
          (item) => item.organizationId === organizationId && item.status === "pending_review",
        );
        return { items, count: items.length };
      },
    },
    workOrders: {
      newId: () => "wo-1",
      async getById(id) { return workOrders.get(id) ?? null; },
      async create(entity) { workOrders.set(entity.id, entity); return { id: entity.id, item: entity }; },
      async save(entity) { workOrders.set(entity.id, entity); return { id: entity.id, item: entity }; },
      async listByOrganizationId() { return { items: [], count: 0 }; },
      async listByClientOrganizationId() { return { items: [], count: 0 }; },
      async listByLocationId() { return { items: [], count: 0 }; },
      async listByCoordinatorUserId() { return { items: [], count: 0 }; },
      async listByManagerUserId() { return { items: [], count: 0 }; },
      async listByContractorOrganizationId() { return { items: [], count: 0 }; },
    },
  };

  return {
    attachments,
    domainEvents,
    domainEventsService: {
      async record<TType extends DomainEventType>(
        input: RecordDomainEventInput<TType>,
      ) {
        const event = {
          id: `evt-${domainEvents.length + 1}`,
          organizationId: input.organizationId,
          tenantId: input.organizationId,
          workOrderId: input.workOrderId,
          type: input.type,
          actor: {
            actorId: input.actor.userId,
            actorType: "user" as const,
            actorRole: input.actor.role,
            displayName: "Test Actor",
          },
          visibility: input.visibility,
          occurredAt: input.now ?? "2026-05-06T09:00:00.000Z",
          lifecycleStatus: input.lifecycleStatus,
          entity: input.entity,
          summary: input.summary,
          metadata: {
            requestId: input.requestId ?? null,
            reason: input.reason ?? null,
            correlationId: input.correlationId ?? null,
            details: {},
          },
          payload: input.payload,
        } as DomainEvent<TType>;
        domainEvents.push(event as DomainEvent);
        return { ok: true as const, value: event };
      },
      async recordTransition(input: RecordTransitionAuditInput) {
        void input;
        throw new Error("not implemented");
      },
      async listTimelineForWorkOrder() {
        return { ok: true as const, value: [] };
      },
      async listTimelineForEntity() {
        return { ok: true as const, value: [] };
      },
    },
    links,
    matchSuggestions,
    messages,
    participants,
    repositories,
    threads,
    workOrders,
  };
}

function makeWorkOrder(): WorkOrder {
  return {
    id: "wo-1",
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-05-06T09:00:00.000Z",
    updatedAt: "2026-05-06T09:00:00.000Z",
    createdByUserId: "manager-1",
    updatedByUserId: "manager-1",
    deletedAt: null,
    deletedByUserId: null,
    workOrderNumber: "WO-1",
    title: "Broken sink",
    description: "Fix sink leak",
    poNumber: null,
    requestedByName: "Store Manager",
    requestedByEmail: null,
    requestedByPhone: null,
    requestedServiceDate: null,
    dueDate: null,
    category: "plumbing",
    requiresQuote: false,
    quoteRequiredThresholdCents: null,
    lifecycleStatus: "triage",
    status: "triage",
    assignmentStatus: null,
    quoteSummaryStatus: null,
    invoiceSummaryStatus: null,
    approvalStatus: null,
    priority: "medium",
    clientOrganizationId: "client-org-1",
    locationId: "loc-1",
    requestedByContactId: null,
    siteContactId: null,
    coordinatorUserId: null,
    managerUserId: null,
    assignedCoordinatorUserId: null,
    assignedManagerUserId: null,
    assignedContractorOrgId: null,
    assignedContractorId: null,
    assignedContractorContactId: null,
    financeOwnerUserId: null,
    quoteReviewerUserId: null,
    currentQuoteId: null,
    currentInvoiceId: null,
    currentQuoteVersionNumber: null,
    invoiceNumber: null,
    clientSnapshot: { id: "client-org-1", name: "Client" },
    locationSnapshot: { id: "loc-1", name: "Location", addressText: null },
    contractorSnapshot: null,
    lastActivityAt: null,
    nextActionOwnerType: null,
    nextActionDueAt: null,
    isEscalated: false,
    escalationReason: null,
    holdReason: null,
    previousLifecycleStatus: null,
    intakeReceivedAt: null,
    submittedAt: null,
    triagedAt: null,
    assignedAt: null,
    contractorContactedAt: null,
    contractorRespondedAt: null,
    contractorScheduledAt: null,
    workStartedAt: null,
    quoteRequestedAt: null,
    contractorQuoteReceivedAt: null,
    quoteReviewStartedAt: null,
    clientApprovalRequestedAt: null,
    clientApprovedAt: null,
    approvedAt: null,
    workCompletedAt: null,
    completedAt: null,
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

function makeMessage(overrides: Partial<CommunicationMessage>): CommunicationMessage {
  return {
    id: "message-1",
    organizationId: "org-1",
    tenantId: "org-1",
    threadId: "thread-1",
    workOrderId: "wo-1",
    referenceMessageId: null,
    channel: "internal_note",
    direction: "internal",
    visibility: ["internal"],
    subject: null,
    body: "Message",
    plainTextBody: "Message",
    normalizedContent: "message",
    metadata: {},
    senderActorId: "manager-1",
    senderActorType: "user",
    senderActorRole: USER_ROLES.Manager,
    participantIds: [],
    clientContactId: null,
    contractorOrganizationId: null,
    linkedEntityIds: ["wo-1"],
    relatedEventIds: [],
    sentAt: "2026-05-06T09:00:00.000Z",
    deliveredAt: null,
    readAt: null,
    externalProvider: null,
    externalThreadId: null,
    externalMessageId: null,
    createdAt: "2026-05-06T09:00:00.000Z",
    createdByActor: {
      actorId: "manager-1",
      actorType: "user",
      actorRole: USER_ROLES.Manager,
      displayName: "Manager",
    },
    ...overrides,
  };
}
