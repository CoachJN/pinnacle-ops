import assert from "node:assert/strict";
import test from "node:test";

import { createCommunicationServices } from "../server/services/communication-service.ts";
import { createDomainEventService } from "../server/services/domain-event-service.ts";
import { createIntakeServices } from "../server/services/intake-service.ts";
import { createTimelineService } from "../server/services/timeline-service.ts";
import { createWorkOrderService } from "../server/services/work-order-service.ts";
import type { ClientLocationService } from "../server/services/client-location-service.ts";
import type {
  DomainEvent,
  TransitionAudit,
  TransitionEvent,
} from "../server/events/types.ts";
import type {
  CommunicationAttachment,
  CommunicationLink,
  CommunicationMatchSuggestion,
  CommunicationMessage,
  CommunicationParticipant,
  CommunicationThread,
} from "../modules/communications/index.ts";
import type {
  ProviderConnection,
  ProviderMessageReceipt,
  ProviderSyncCheckpoint,
  ProviderThreadMapping,
} from "../modules/providers/index.ts";
import type {
  ProviderConnectionRepository,
  ProviderMessageReceiptRepository,
  ProviderSyncCheckpointRepository,
  ProviderThreadMappingRepository,
} from "../server/repositories/index.ts";
import type {
  AiIntakeDraft,
  IntakeApproval,
  IntakeArtifact,
  IntakeDecision,
  IntakeEvent,
} from "../modules/intake/index.ts";
import type {
  AiIntakeDraftRepository,
  ClientInvoiceRepository,
  ClientOrganizationRepository,
  ClientQuoteRepository,
  CommunicationAttachmentRepository,
  CommunicationLinkRepository,
  CommunicationMatchSuggestionRepository,
  CommunicationMessageRepository,
  CommunicationParticipantRepository,
  CommunicationThreadRepository,
  ContractorOrganizationRepository,
  DomainEventRepository,
  FirestoreRepositories,
  IntakeApprovalRepository,
  IntakeArtifactRepository,
  IntakeDecisionRepository,
  IntakeEventRepository,
  Location,
  LocationRepository,
  TransitionAuditRepository,
  TransitionEventRepository,
  WorkOrder,
  WorkOrderRepository,
} from "../server/repositories/index.ts";
import { USER_ROLES } from "../types/permissions.ts";
import type { WorkOrderMutationContext } from "../server/services/work-order-mutation-context.ts";

test("intake event creation persists immutable artifacts, evidence, confidence, and review queue projections", async () => {
  const harness = createHarness();

  const intakeEvent = await harness.intake.events.create({
    ...coordinatorMutationContext(),
    source: {
      sourceType: "portal_submission",
      externalSourceId: "portal-1",
      communicationThreadId: null,
      communicationMessageId: null,
      attachmentId: null,
      portalSubmissionId: "portal-1",
      metadata: { form: "service_request" },
    },
    summary: "Leaking freezer at store 101",
  });
  assert.equal(intakeEvent.ok, true);

  const artifact = await harness.intake.events.addArtifact({
    ...coordinatorMutationContext(),
    intakeEventId: intakeEvent.value.id,
    kind: "normalized_content",
    source: intakeEvent.value.source,
    normalizedContent: "Freezer leaking in back room. Please send someone today.",
    rawContent: "{\"message\":\"Freezer leaking\"}",
  });
  assert.equal(artifact.ok, true);
  assert.equal(artifact.value.isImmutable, true);

  const draft = await harness.intake.drafts.create({
    ...coordinatorMutationContext(),
    intakeEventId: intakeEvent.value.id,
    artifactIds: [artifact.value.id],
    extractedTitle: "Freezer leak",
    extractedDescription: "Freezer leaking in the back room.",
    extractedPriority: "high",
    extractedCategory: "HVAC",
    extractedClient: candidate("client-1", "Client Org", "client", "client-org-1", 0.97),
    extractedLocation: candidate("location-1", "Store 101", "location", "loc-1", 0.95),
    extractedContacts: [candidate("contact-1", "Jamie Site", "contact", "contact-1", 0.86)],
    overallConfidence: 0.88,
    perFieldConfidence: { title: 0.91, description: 0.89, location: 0.95 },
    evidence: [
      {
        id: "evidence-1",
        field: "title",
        sourceType: "portal_submission",
        confidence: 0.91,
        artifactId: artifact.value.id,
        communicationMessageId: null,
        attachmentId: null,
        excerpt: "Freezer leaking in back room",
        startOffset: 0,
        endOffset: 29,
        rationale: "Direct issue summary in customer text.",
        metadata: {},
      },
    ],
    extractedSnippets: ["Please send someone today."],
    duplicateCandidates: [
      {
        id: "dup-1",
        candidateWorkOrderId: "wo-existing",
        candidateWorkOrderNumber: "WO-EXISTING",
        confidence: 0.74,
        rationale: "Same store and issue phrase.",
        status: "pending_review",
        metadata: {},
      },
    ],
    aiModel: "test-model",
    aiPromptVersion: "v1",
    aiRunId: "run-1",
  });
  assert.equal(draft.ok, true);
  assert.equal(draft.value.evidence.length, 1);
  assert.equal(draft.value.perFieldConfidence.location, 0.95);
  assert.equal(draft.value.duplicateCandidates.length, 1);

  const queue = await harness.intake.query.listReviewQueue("org-1", internalActor());
  assert.equal(queue.ok, true);
  assert.equal(queue.value.length, 1);
  assert.equal(queue.value[0].reviewStatus, "pending_review");

  const clientQueue = await harness.intake.query.listReviewQueue("org-1", clientActor());
  assert.equal(clientQueue.ok, true);
  assert.deepEqual(clientQueue.value, []);

  const context = await harness.intake.query.getReviewContext(intakeEvent.value.id, internalActor());
  assert.equal(context.ok, true);
  assert.deepEqual(
    context.value.timeline.map((entry) => entry.type),
    ["ai_intake_draft_created", "intake_artifact_created", "intake_event_created"],
  );
});

test("approved intake converts through the canonical work order boundary and writes durable events", async () => {
  const harness = createHarness();
  const setup = await seedDraftForReview(harness);

  const review = await harness.intake.review.review({
    ...managerMutationContext(),
    aiIntakeDraftId: setup.draft.id,
    decision: "approve_with_edits",
    reviewerNotes: "Looks good with a clearer title.",
    approvedInput: {
      title: "Walk-in freezer leak",
      requestedByEmail: "site@example.com",
      requestedByPhone: "555-0100",
    },
  });

  assert.equal(review.ok, true);
  assert.equal(review.value.approval?.decision, "approve_with_edits");
  assert.ok(review.value.workOrderId);
  assert.equal(harness.workOrders.size, 1);

  const createdWorkOrder = [...harness.workOrders.values()][0];
  assert.equal(createdWorkOrder.title, "Walk-in freezer leak");
  assert.equal(createdWorkOrder.requestedByEmail, "site@example.com");
  assert.equal(createdWorkOrder.requestedByPhone, "555-0100");

  const timeline = await harness.domainEventsService.listTimelineForWorkOrder(
    createdWorkOrder.id,
    internalActor(),
  );
  assert.equal(timeline.ok, true);
  assert.deepEqual(
    timeline.value.map((entry) => entry.type),
    [
      "intake_conversion_completed",
      "duplicate_reviewed",
      "intake_review_decision_recorded",
      "work_order_created",
    ],
  );

  assert.equal(
    harness.domainEvents.some((event) => event.type === "intake_conversion_completed"),
    true,
  );
});

test("replayed intake approval reuses the canonical converted work order without duplicating it", async () => {
  const harness = createHarness();
  const setup = await seedDraftForReview(harness);
  const input = {
    ...managerMutationContext(),
    aiIntakeDraftId: setup.draft.id,
    decision: "approve_with_edits" as const,
    reviewerNotes: "Looks good with a clearer title.",
    approvedInput: {
      title: "Walk-in freezer leak",
      requestedByEmail: "site@example.com",
      requestedByPhone: "555-0100",
    },
  };

  const first = await harness.intake.review.review(input);
  const second = await harness.intake.review.review(input);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.value.workOrderId, second.value.workOrderId);
  assert.equal(harness.workOrders.size, 1);
});

test("merge decisions persist duplicate review outcomes without creating a new work order", async () => {
  const harness = createHarness();
  const setup = await seedDraftForReview(harness);

  const merge = await harness.intake.review.review({
    ...managerMutationContext(),
    aiIntakeDraftId: setup.draft.id,
    decision: "merge_into_existing",
    reviewerNotes: "Confirmed as duplicate of the open freezer ticket.",
    mergedIntoWorkOrderId: "wo-existing",
    falsePositiveDuplicateCandidateIds: ["dup-2"],
  });

  assert.equal(merge.ok, true);
  assert.equal(merge.value.workOrderId, "wo-existing");
  assert.equal(harness.workOrders.size, 0);
  assert.equal(merge.value.draft.reviewStatus, "merged_into_existing");
  assert.equal(merge.value.draft.duplicateCandidates[1]?.status, "false_positive");
  assert.equal(
    harness.domainEvents.some((event) => event.type === "duplicate_merged"),
    true,
  );
});

test("review queue filters support assignment, duplicate risk, and lifecycle recommendation", async () => {
  const harness = createHarness();
  const setup = await seedDraftForReview(harness);

  const started = await harness.intake.review.start({
    ...managerMutationContext(),
    aiIntakeDraftId: setup.draft.id,
  });
  assert.equal(started.ok, true);

  const assigned = await harness.intake.review.assign({
    ...managerMutationContext(),
    aiIntakeDraftId: setup.draft.id,
    assignedReviewerUserId: "manager-1",
  });
  assert.equal(assigned.ok, true);

  const filtered = await harness.intake.query.listReviewQueue("org-1", internalActor(), {
    reviewStatus: "under_review",
    assignedReviewerUserId: "manager-1",
    duplicateRisk: "medium",
    lifecycleRecommendation: "new",
  });
  assert.equal(filtered.ok, true);
  assert.equal(filtered.value.length, 1);
  assert.equal(filtered.value[0].duplicateRisk, "medium");
});

test("provider-safe ingestion creates canonical intake and communication records without mutating work orders", async () => {
  const harness = createHarness();

  const result = await harness.intake.ingestion.ingestProviderPayload({
    ...systemMutationContext(),
    payload: makeProviderPayload(),
  });

  assert.equal(result.ok, true);
  assert.equal(harness.workOrders.size, 0);
  assert.equal(result.value.communicationMessage?.workOrderId, null);
  assert.equal(result.value.communicationAttachments.length, 1);
  assert.equal(result.value.intakeArtifact.attachmentReferences.length, 1);
  assert.equal(result.value.providerMessageReceipt.status, "ingested");
  assert.equal(
    harness.domainEvents.some((event) => event.type === "communication_message_linked"),
    true,
  );
});

test("provider ingestion is idempotent and reuses canonical records for duplicate email payloads", async () => {
  const harness = createHarness();
  const payload = makeProviderPayload();

  const first = await harness.intake.ingestion.ingestProviderPayload({
    ...systemMutationContext(),
    payload,
  });
  const duplicate = await harness.intake.ingestion.ingestProviderPayload({
    ...systemMutationContext(),
    payload,
  });

  assert.equal(first.ok, true);
  assert.equal(duplicate.ok, true);
  assert.equal(harness.intakeEvents.length, 1);
  assert.equal(harness.intakeArtifacts.length, 1);
  assert.equal(harness.providerMessageReceipts.length, 1);
  assert.equal(harness.providerThreadMappings.length, 1);
  assert.equal(duplicate.value.communicationMessage?.id, first.value.communicationMessage?.id);
  assert.equal(
    harness.domainEvents.some((event) => event.type === "provider_duplicate_detected"),
    true,
  );
});

function createHarness() {
  const domainEvents: DomainEvent[] = [];
  const transitionEvents: TransitionEvent[] = [];
  const transitionAudits: TransitionAudit[] = [];
  const intakeEvents: IntakeEvent[] = [];
  const intakeArtifacts: IntakeArtifact[] = [];
  const aiDrafts: AiIntakeDraft[] = [];
  const approvals: IntakeApproval[] = [];
  const decisions: IntakeDecision[] = [];
  const communicationThreads: CommunicationThread[] = [];
  const communicationMessages: CommunicationMessage[] = [];
  const communicationParticipants: CommunicationParticipant[] = [];
  const communicationLinks: CommunicationLink[] = [];
  const communicationAttachments: CommunicationAttachment[] = [];
  const communicationMatchSuggestions: CommunicationMatchSuggestion[] = [];
  const providerConnections: ProviderConnection[] = [];
  const providerSyncCheckpoints: ProviderSyncCheckpoint[] = [];
  const providerMessageReceipts: ProviderMessageReceipt[] = [];
  const providerThreadMappings: ProviderThreadMapping[] = [];
  const workOrders = new Map<string, WorkOrder>();
  const eventRepos = createEventRepositories(domainEvents, transitionEvents, transitionAudits);

  const repositories = {
    ...eventRepos.repositories,
    intakeEvents: createIntakeEventRepository(intakeEvents),
    intakeArtifacts: createIntakeArtifactRepository(intakeArtifacts),
    aiIntakeDrafts: createAiDraftRepository(aiDrafts),
    intakeApprovals: createIntakeApprovalRepository(approvals),
    intakeDecisions: createIntakeDecisionRepository(decisions),
    communicationThreads: createCommunicationThreadRepository(communicationThreads),
    communicationMessages: createCommunicationMessageRepository(communicationMessages),
    communicationParticipants: createCommunicationParticipantRepository(communicationParticipants),
    communicationLinks: createCommunicationLinkRepository(communicationLinks),
    communicationAttachments: createCommunicationAttachmentRepository(communicationAttachments),
    communicationMatchSuggestions: createCommunicationMatchSuggestionRepository(communicationMatchSuggestions),
    providerConnections: createProviderConnectionRepository(providerConnections),
    providerSyncCheckpoints: createProviderSyncCheckpointRepository(providerSyncCheckpoints),
    providerMessageReceipts: createProviderMessageReceiptRepository(providerMessageReceipts),
    providerThreadMappings: createProviderThreadMappingRepository(providerThreadMappings),
    workOrders: createWorkOrderRepository(workOrders),
    clientOrganizations: createClientOrganizationRepository(),
    locations: createLocationRepository(),
    clientQuotes: createEmptyClientQuoteRepository(),
    clientInvoices: createEmptyClientInvoiceRepository(),
    contractorOrganizations: createEmptyContractorOrganizationRepository(),
  } satisfies Pick<
    FirestoreRepositories,
    | "aiIntakeDrafts"
    | "clientInvoices"
    | "clientOrganizations"
    | "clientQuotes"
    | "communicationAttachments"
    | "communicationLinks"
    | "communicationMatchSuggestions"
    | "communicationMessages"
    | "communicationParticipants"
    | "communicationThreads"
    | "contractorOrganizations"
    | "domainEvents"
    | "intakeApprovals"
    | "intakeArtifacts"
    | "intakeDecisions"
    | "intakeEvents"
    | "locations"
    | "providerConnections"
    | "providerMessageReceipts"
    | "providerSyncCheckpoints"
    | "providerThreadMappings"
    | "transitionAudits"
    | "transitionEvents"
    | "workOrders"
  >;

  const domainEventsService = createDomainEventService(eventRepos.repositories);
  const timelineService = createTimelineService(eventRepos.repositories, {
    domainEvents: domainEventsService,
  });
  const communicationServices = createCommunicationServices(repositories, {
    domainEvents: domainEventsService,
  });
  const workOrderService = createWorkOrderService(repositories, {
    domainEvents: domainEventsService,
    clientLocations: {
      async getClientLocationContext() {
        const client = await repositories.clientOrganizations.getById("client-org-1");
        const location = await repositories.locations.getById("loc-1");
        assert.ok(client);
        assert.ok(location);
        return {
          ok: true as const,
          value: {
            client,
            location,
          },
        };
      },
    } as unknown as ClientLocationService,
  });
  const intake = createIntakeServices(repositories, {
    communications: communicationServices,
    domainEvents: domainEventsService,
    timeline: timelineService,
    workOrders: workOrderService,
  });

  return {
    approvals,
    aiDrafts,
    decisions,
    domainEvents,
    domainEventsService,
    intake,
    intakeArtifacts,
    intakeEvents,
    providerMessageReceipts,
    providerThreadMappings,
    workOrders,
  };
}

function makeProviderPayload() {
  return {
    organizationId: "org-1",
    sourceType: "email" as const,
    channel: "email" as const,
    receivedAt: now(),
    sentAt: now(),
    summary: "Store emailed about a freezer leak.",
    message: {
      subject: "Freezer leak",
      body: "Our walk-in freezer is leaking and needs help.",
      plainTextBody: "Our walk-in freezer is leaking and needs help.",
      normalizedText: "our walk-in freezer is leaking and needs help.",
      preview: "walk-in freezer is leaking",
    },
    sender: {
      displayName: "Store 101",
      email: "store101@example.com",
      phone: null,
      externalParticipantId: "sender-1",
      metadata: {},
    },
    recipients: [],
    attachments: [
      {
        id: "provider-attachment-1",
        fileName: "photo.jpg",
        contentType: "image/jpeg",
        sizeBytes: 1024,
        storagePath: "provider/email/photo.jpg",
        externalAttachmentId: "external-attachment-1",
        uploadedAt: now(),
        hydrationStatus: "pending" as const,
        hydratedAt: null,
        hydrationError: null,
        metadata: {},
      },
    ],
    thread: {
      threadId: "thread-ext-1",
      parentMessageId: null,
      conversationKey: "conv-1",
      messageKey: "msg-1",
    },
    provider: {
      providerKey: "microsoft_graph" as const,
      providerType: "email" as const,
      providerConnectionId: "provider-connection-1",
      providerAccountId: "acct-1",
      providerTenantId: "tenant-1",
      externalMessageId: "external-message-1",
      externalInternetMessageId: "<internet-message-1@example.com>",
      externalThreadId: "external-thread-1",
      externalConversationId: "conv-1",
      metadata: {},
    },
    emailMessage: {
      subject: "Freezer leak",
      body: "Our walk-in freezer is leaking and needs help.",
      plainTextBody: "Our walk-in freezer is leaking and needs help.",
      normalizedText: "our walk-in freezer is leaking and needs help.",
      preview: "walk-in freezer is leaking",
      sender: {
        displayName: "Store 101",
        email: "store101@example.com",
        externalParticipantId: "sender-1",
        metadata: {},
      },
      recipients: [],
      cc: [],
      bcc: [],
      messageId: "external-message-1",
      internetMessageId: "<internet-message-1@example.com>",
      conversationId: "conv-1",
      inReplyTo: null,
      replyReferences: [],
      receivedAt: now(),
      sentAt: now(),
      attachments: [
        {
          id: "provider-attachment-1",
          providerAttachmentId: "external-attachment-1",
          fileName: "photo.jpg",
          mimeType: "image/jpeg",
          sizeBytes: 1024,
          storagePath: "provider/email/photo.jpg",
          contentId: null,
          isInline: false,
          uploadedAt: now(),
          checksum: null,
          hydrationStatus: "pending" as const,
          hydratedAt: null,
          hydrationError: null,
          metadata: {},
        },
      ],
      metadata: {},
    },
    emailThread: {
      providerThreadId: "external-thread-1",
      providerConversationId: "conv-1",
      parentProviderMessageId: null,
      parentInternetMessageId: null,
      conversationIndex: "abc",
      conversationPath: ["conv-1", "external-message-1"],
      threadFingerprint: "microsoft_graph|conv-1|freezer leak",
      metadata: {},
    },
    emailSender: {
      displayName: "Store 101",
      email: "store101@example.com",
      externalParticipantId: "sender-1",
      metadata: {},
    },
    emailRecipients: [],
    emailCc: [],
    emailBcc: [],
    emailAttachments: [
      {
        id: "provider-attachment-1",
        providerAttachmentId: "external-attachment-1",
        fileName: "photo.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 1024,
        storagePath: "provider/email/photo.jpg",
        contentId: null,
        isInline: false,
        uploadedAt: now(),
        checksum: null,
        hydrationStatus: "pending" as const,
        hydratedAt: null,
        hydrationError: null,
        metadata: {},
      },
    ],
    metadata: {},
  };
}

async function seedDraftForReview(harness: ReturnType<typeof createHarness>) {
  const intakeEventResult = await harness.intake.events.create({
    ...coordinatorMutationContext(),
    source: {
      sourceType: "communication_message",
      externalSourceId: "msg-1",
      communicationThreadId: "thread-1",
      communicationMessageId: "msg-1",
      attachmentId: null,
      portalSubmissionId: null,
      metadata: {},
    },
    summary: "Back room freezer leak",
  });
  assert.equal(intakeEventResult.ok, true);

  const artifactResult = await harness.intake.events.addArtifact({
    ...coordinatorMutationContext(),
    intakeEventId: intakeEventResult.value.id,
    kind: "normalized_content",
    source: intakeEventResult.value.source,
    normalizedContent: "Store 101 says the walk-in freezer is leaking water.",
  });
  assert.equal(artifactResult.ok, true);

  const draftResult = await harness.intake.drafts.create({
    ...coordinatorMutationContext(),
    intakeEventId: intakeEventResult.value.id,
    artifactIds: [artifactResult.value.id],
    extractedTitle: "Freezer leak",
    extractedDescription: "Water leaking from walk-in freezer.",
    extractedPriority: "high",
    extractedCategory: "HVAC",
    extractedSuggestedLifecycle: "new",
    extractedClient: candidate("client-1", "Client Org", "client", "client-org-1", 0.96),
    extractedLocation: candidate("location-1", "Store 101", "location", "loc-1", 0.95),
    extractedContacts: [candidate("contact-1", "Jamie Site", "contact", "contact-1", 0.84)],
    overallConfidence: 0.9,
    duplicateCandidates: [
      {
        id: "dup-1",
        candidateWorkOrderId: "wo-existing",
        candidateWorkOrderNumber: "WO-EXISTING",
        confidence: 0.81,
        rationale: "Same issue and location.",
        status: "pending_review",
        metadata: {},
      },
      {
        id: "dup-2",
        candidateWorkOrderId: "wo-old",
        candidateWorkOrderNumber: "WO-OLD",
        confidence: 0.41,
        rationale: "Weak historic similarity.",
        status: "pending_review",
        metadata: {},
      },
    ],
    aiModel: "test-model",
    aiPromptVersion: "v1",
    aiRunId: "run-1",
  });
  assert.equal(draftResult.ok, true);

  return {
    event: intakeEventResult.value,
    artifact: artifactResult.value,
    draft: draftResult.value,
  };
}

function createEventRepositories(
  domainEvents: DomainEvent[],
  transitionEvents: TransitionEvent[],
  transitionAudits: TransitionAudit[],
) {
  const repositories = {
    domainEvents: {
      newId: () => `evt-${domainEvents.length + 1}`,
      async getById(id) {
        return domainEvents.find((event) => event.id === id) ?? null;
      },
      async create(entity) {
        domainEvents.push(entity);
        return { id: entity.id, item: entity };
      },
      async save(entity) {
        return { id: entity.id, item: entity };
      },
      async listByOrganizationId(organizationId) {
        const items = domainEvents.filter((event) => event.organizationId === organizationId);
        return { items, count: items.length };
      },
      async listByWorkOrderId(workOrderId) {
        const items = domainEvents.filter((event) => event.workOrderId === workOrderId);
        return { items, count: items.length };
      },
      async listByEntity(entity) {
        const items = domainEvents.filter((event) =>
          event.entity.entityType === entity.entityType &&
          event.entity.entityId === entity.entityId
        );
        return { items, count: items.length };
      },
    } satisfies DomainEventRepository,
    transitionEvents: {
      newId: () => `te-${transitionEvents.length + 1}`,
      async getById(id) {
        return transitionEvents.find((event) => event.id === id) ?? null;
      },
      async create(entity) {
        transitionEvents.push(entity);
        return { id: entity.id, item: entity };
      },
      async save(entity) {
        return { id: entity.id, item: entity };
      },
      async listByWorkOrderId(workOrderId) {
        const items = transitionEvents.filter((event) => event.workOrderId === workOrderId);
        return { items, count: items.length };
      },
    } satisfies TransitionEventRepository,
    transitionAudits: {
      newId: () => `ta-${transitionAudits.length + 1}`,
      async getById(id) {
        return transitionAudits.find((audit) => audit.id === id) ?? null;
      },
      async create(entity) {
        transitionAudits.push(entity);
        return { id: entity.id, item: entity };
      },
      async save(entity) {
        return { id: entity.id, item: entity };
      },
      async listByWorkOrderId(workOrderId) {
        const items = transitionAudits.filter((audit) => audit.workOrderId === workOrderId);
        return { items, count: items.length };
      },
    } satisfies TransitionAuditRepository,
  };

  return { repositories };
}

function createIntakeEventRepository(store: IntakeEvent[]): IntakeEventRepository {
  return {
    newId: () => `intake-${store.length + 1}`,
    async getById(id) {
      return store.find((item) => item.id === id) ?? null;
    },
    async create(entity) {
      store.push(entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      upsertById(store, entity);
      return { id: entity.id, item: entity };
    },
    async listByOrganizationId(organizationId, options = {}) {
      const items = store.filter((item) =>
        item.organizationId === organizationId &&
        (options.status == null || item.status === options.status)
      );
      return { items, count: items.length };
    },
  };
}

function createIntakeArtifactRepository(store: IntakeArtifact[]): IntakeArtifactRepository {
  return {
    newId: () => `artifact-${store.length + 1}`,
    async getById(id) {
      return store.find((item) => item.id === id) ?? null;
    },
    async create(entity) {
      store.push(entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      upsertById(store, entity);
      return { id: entity.id, item: entity };
    },
    async listByIntakeEventId(intakeEventId) {
      const items = store.filter((item) => item.intakeEventId === intakeEventId);
      return { items, count: items.length };
    },
  };
}

function createAiDraftRepository(store: AiIntakeDraft[]): AiIntakeDraftRepository {
  return {
    newId: () => `draft-${store.length + 1}`,
    async getById(id) {
      return store.find((item) => item.id === id) ?? null;
    },
    async create(entity) {
      store.push(entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      upsertById(store, entity);
      return { id: entity.id, item: entity };
    },
    async listByIntakeEventId(intakeEventId) {
      const items = store.filter((item) => item.intakeEventId === intakeEventId);
      return { items, count: items.length };
    },
    async listPendingReview(organizationId) {
      const items = store.filter((item) =>
        item.organizationId === organizationId &&
        (item.reviewStatus === "pending_review" ||
          item.reviewStatus === "under_review" ||
          item.reviewStatus === "escalated")
      );
      return { items, count: items.length };
    },
  };
}

function createIntakeApprovalRepository(store: IntakeApproval[]): IntakeApprovalRepository {
  return {
    newId: () => `approval-${store.length + 1}`,
    async getById(id) {
      return store.find((item) => item.id === id) ?? null;
    },
    async create(entity) {
      store.push(entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      upsertById(store, entity);
      return { id: entity.id, item: entity };
    },
    async listByIntakeEventId(intakeEventId) {
      const items = store.filter((item) => item.intakeEventId === intakeEventId);
      return { items, count: items.length };
    },
  };
}

function createIntakeDecisionRepository(store: IntakeDecision[]): IntakeDecisionRepository {
  return {
    newId: () => `decision-${store.length + 1}`,
    async getById(id) {
      return store.find((item) => item.id === id) ?? null;
    },
    async create(entity) {
      store.push(entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      upsertById(store, entity);
      return { id: entity.id, item: entity };
    },
    async listByIntakeEventId(intakeEventId) {
      const items = store.filter((item) => item.intakeEventId === intakeEventId);
      return { items, count: items.length };
    },
  };
}

function createCommunicationThreadRepository(
  store: CommunicationThread[],
): CommunicationThreadRepository {
  return {
    newId: () => `thread-${store.length + 1}`,
    async getById(id) {
      return store.find((item) => item.id === id) ?? null;
    },
    async create(entity) {
      store.push(entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      upsertById(store, entity);
      return { id: entity.id, item: entity };
    },
    async listByWorkOrderId(workOrderId) {
      const items = store.filter((item) => item.workOrderId === workOrderId);
      return { items, count: items.length };
    },
    async findByWorkOrderChannelVisibility(input) {
      return (
        store.find((item) =>
          item.workOrderId === input.workOrderId &&
          item.channel === input.channel &&
          item.visibility.slice().sort().join("|") === input.visibility.slice().sort().join("|"),
        ) ?? null
      );
    },
  };
}

function createCommunicationMessageRepository(
  store: CommunicationMessage[],
): CommunicationMessageRepository {
  return {
    newId: () => `message-${store.length + 1}`,
    async getById(id) {
      return store.find((item) => item.id === id) ?? null;
    },
    async create(entity) {
      store.push(entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      upsertById(store, entity);
      return { id: entity.id, item: entity };
    },
    async listByThreadId(threadId) {
      const items = store.filter((item) => item.threadId === threadId);
      return { items, count: items.length };
    },
    async listByWorkOrderId(workOrderId) {
      const items = store.filter((item) => item.workOrderId === workOrderId);
      return { items, count: items.length };
    },
  };
}

function createCommunicationParticipantRepository(
  store: CommunicationParticipant[],
): CommunicationParticipantRepository {
  return {
    newId: () => `participant-${store.length + 1}`,
    async getById(id) {
      return store.find((item) => item.id === id) ?? null;
    },
    async create(entity) {
      store.push(entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      upsertById(store, entity);
      return { id: entity.id, item: entity };
    },
    async listByThreadId(threadId) {
      const items = store.filter((item) => item.threadId === threadId);
      return { items, count: items.length };
    },
  };
}

function createCommunicationLinkRepository(
  store: CommunicationLink[],
): CommunicationLinkRepository {
  return {
    newId: () => `link-${store.length + 1}`,
    async getById(id) {
      return store.find((item) => item.id === id) ?? null;
    },
    async create(entity) {
      store.push(entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      upsertById(store, entity);
      return { id: entity.id, item: entity };
    },
    async listByMessageId(messageId) {
      const items = store.filter((item) => item.messageId === messageId);
      return { items, count: items.length };
    },
    async listByWorkOrderId(workOrderId) {
      const items = store.filter((item) => item.workOrderId === workOrderId);
      return { items, count: items.length };
    },
  };
}

function createCommunicationAttachmentRepository(
  store: CommunicationAttachment[],
): CommunicationAttachmentRepository {
  return {
    newId: () => `attachment-${store.length + 1}`,
    async getById(id) {
      return store.find((item) => item.id === id) ?? null;
    },
    async create(entity) {
      store.push(entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      upsertById(store, entity);
      return { id: entity.id, item: entity };
    },
    async listByMessageId(messageId) {
      const items = store.filter((item) => item.messageId === messageId);
      return { items, count: items.length };
    },
    async listByWorkOrderId(workOrderId) {
      const items = store.filter((item) => item.workOrderId === workOrderId);
      return { items, count: items.length };
    },
  };
}

function createCommunicationMatchSuggestionRepository(
  store: CommunicationMatchSuggestion[],
): CommunicationMatchSuggestionRepository {
  return {
    newId: () => `match-${store.length + 1}`,
    async getById(id) {
      return store.find((item) => item.id === id) ?? null;
    },
    async create(entity) {
      store.push(entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      upsertById(store, entity);
      return { id: entity.id, item: entity };
    },
    async listByWorkOrderId(workOrderId) {
      const items = store.filter((item) => item.workOrderId === workOrderId);
      return { items, count: items.length };
    },
    async listPendingReview(organizationId) {
      const items = store.filter((item) => item.organizationId === organizationId);
      return { items, count: items.length };
    },
  };
}

function createProviderConnectionRepository(
  store: ProviderConnection[],
): ProviderConnectionRepository {
  return {
    newId: () => `provider-connection-${store.length + 1}`,
    async getById(id) {
      return store.find((item) => item.id === id) ?? null;
    },
    async create(entity) {
      store.push(entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      upsertById(store, entity);
      return { id: entity.id, item: entity };
    },
    async listByOrganizationId(organizationId) {
      const items = store.filter((item) => item.organizationId === organizationId);
      return { items, count: items.length };
    },
    async findByWebhookSubscription(input) {
      return store.find((item) =>
        item.providerKey === input.providerKey &&
        item.metadata.webhookSubscriptionId === input.subscriptionId
      ) ?? null;
    },
    async findByMailboxAddress(input) {
      return store.find((item) =>
        item.organizationId === input.organizationId &&
        item.providerKey === input.providerKey &&
        item.mailboxAddress === input.mailboxAddress
      ) ?? null;
    },
  };
}

function createProviderSyncCheckpointRepository(
  store: ProviderSyncCheckpoint[],
): ProviderSyncCheckpointRepository {
  return {
    newId: () => `provider-checkpoint-${store.length + 1}`,
    async getById(id) {
      return store.find((item) => item.id === id) ?? null;
    },
    async create(entity) {
      store.push(entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      upsertById(store, entity);
      return { id: entity.id, item: entity };
    },
    async listByConnectionId(providerConnectionId) {
      const items = store.filter((item) => item.providerConnectionId === providerConnectionId);
      return { items, count: items.length };
    },
    async findByScope(input) {
      return store.find((item) =>
        item.organizationId === input.organizationId &&
        item.providerConnectionId === input.providerConnectionId &&
        item.checkpointType === input.checkpointType &&
        item.mailboxScope.mailboxAddress === input.mailboxAddress &&
        item.mailboxScope.folderId === input.folderId
      ) ?? null;
    },
  };
}

function createProviderMessageReceiptRepository(
  store: ProviderMessageReceipt[],
): ProviderMessageReceiptRepository {
  return {
    newId: () => `provider-receipt-${store.length + 1}`,
    async getById(id) {
      return store.find((item) => item.id === id) ?? null;
    },
    async create(entity) {
      store.push(entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      upsertById(store, entity);
      return { id: entity.id, item: entity };
    },
    async findByFingerprint(organizationId, fingerprint) {
      return store.find((item) => item.organizationId === organizationId && item.fingerprint === fingerprint) ?? null;
    },
    async findByProviderMessage(input) {
      return store.find((item) =>
        item.organizationId === input.organizationId &&
        item.providerKey === input.providerKey &&
        item.providerConnectionId === input.providerConnectionId &&
        (
          (input.providerMessageId && item.providerMessageId === input.providerMessageId) ||
          (input.internetMessageId && item.internetMessageId === input.internetMessageId)
        )
      ) ?? null;
    },
    async listByConnectionId(providerConnectionId) {
      const items = store.filter((item) => item.providerConnectionId === providerConnectionId);
      return { items, count: items.length };
    },
    async listByOrganizationId(organizationId) {
      const items = store.filter((item) => item.organizationId === organizationId);
      return { items, count: items.length };
    },
  };
}

function createProviderThreadMappingRepository(
  store: ProviderThreadMapping[],
): ProviderThreadMappingRepository {
  return {
    newId: () => `provider-thread-${store.length + 1}`,
    async getById(id) {
      return store.find((item) => item.id === id) ?? null;
    },
    async create(entity) {
      store.push(entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      upsertById(store, entity);
      return { id: entity.id, item: entity };
    },
    async findByProviderThread(input) {
      return store.find((item) =>
        item.organizationId === input.organizationId &&
        item.providerKey === input.providerKey &&
        item.providerConnectionId === input.providerConnectionId &&
        item.providerThreadId === input.providerThreadId
      ) ?? null;
    },
    async listByConnectionId(providerConnectionId) {
      const items = store.filter((item) => item.providerConnectionId === providerConnectionId);
      return { items, count: items.length };
    },
  };
}

function createWorkOrderRepository(store: Map<string, WorkOrder>): WorkOrderRepository {
  return {
    newId: () => `wo-${store.size + 1}`,
    async getById(id) {
      return store.get(id) ?? null;
    },
    async create(entity) {
      store.set(entity.id, entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      store.set(entity.id, entity);
      return { id: entity.id, item: entity };
    },
    async listByOrganizationId(organizationId) {
      return listWorkOrders(store, (item) => item.organizationId === organizationId);
    },
    async listByClientOrganizationId(clientOrganizationId) {
      return listWorkOrders(store, (item) => item.clientOrganizationId === clientOrganizationId);
    },
    async listByLocationId(locationId) {
      return listWorkOrders(store, (item) => item.locationId === locationId);
    },
    async listByCoordinatorUserId(coordinatorUserId) {
      return listWorkOrders(store, (item) => item.coordinatorUserId === coordinatorUserId);
    },
    async listByManagerUserId(managerUserId) {
      return listWorkOrders(store, (item) => item.managerUserId === managerUserId);
    },
    async listByContractorOrganizationId(contractorOrganizationId) {
      return listWorkOrders(store, (item) => item.assignedContractorOrgId === contractorOrganizationId);
    },
  };
}

function createClientOrganizationRepository(): ClientOrganizationRepository {
  return {
    newId: () => "client-org-1",
    async getById() {
      return {
        id: "client-org-1",
        organizationId: "org-1",
        recordStatus: "active",
        isDeleted: false,
        createdAt: now(),
        updatedAt: now(),
        createdByUserId: "user-1",
        updatedByUserId: "user-1",
        deletedAt: null,
        deletedByUserId: null,
        name: "Client Org",
        displayName: "Client Org",
        status: "active",
        primaryContactId: null,
        billingContactId: null,
        notes: null,
      };
    },
    async create(entity) {
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      return { id: entity.id, item: entity };
    },
    async listByOrganizationId() {
      return { items: [], count: 0 };
    },
    async listActive() {
      return { items: [], count: 0 };
    },
  };
}

function createLocationRepository(): LocationRepository {
  return {
    newId: () => "loc-1",
    async getById() {
      return makeLocation();
    },
    async create(entity) {
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      return { id: entity.id, item: entity };
    },
    async listByOrganizationId() {
      return { items: [makeLocation()], count: 1 };
    },
    async listByClientOrganizationId() {
      return { items: [makeLocation()], count: 1 };
    },
  };
}

function createEmptyClientQuoteRepository(): ClientQuoteRepository {
  return {
    newId: () => "quote-1",
    async getById() {
      return null;
    },
    async create(entity) {
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      return { id: entity.id, item: entity };
    },
    async listByWorkOrderId() {
      return { items: [], count: 0 };
    },
    async getActiveByWorkOrderId() {
      return null;
    },
  };
}

function createEmptyClientInvoiceRepository(): ClientInvoiceRepository {
  return {
    newId: () => "invoice-1",
    async getById() {
      return null;
    },
    async create(entity) {
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      return { id: entity.id, item: entity };
    },
    async listByWorkOrderId() {
      return { items: [], count: 0 };
    },
    async listFinanceQueue() {
      return { items: [], count: 0 };
    },
  };
}

function createEmptyContractorOrganizationRepository(): ContractorOrganizationRepository {
  return {
    newId: () => "contractor-1",
    async getById() {
      return null;
    },
    async create(entity) {
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      return { id: entity.id, item: entity };
    },
    async listByOrganizationId() {
      return { items: [], count: 0 };
    },
    async listActive() {
      return { items: [], count: 0 };
    },
  };
}

function candidate(
  id: string,
  label: string,
  entityType: "client" | "location" | "contact" | "trade" | "work_order",
  entityId: string | null,
  confidence: number,
) {
  return {
    id,
    entityType,
    entityId,
    label,
    confidence,
    rationale: null,
    metadata: {},
  };
}

function internalActor() {
  return {
    actorType: "internal" as const,
    userId: "user-1",
    role: USER_ROLES.Manager,
    scope: { kind: "internal" as const, organizationId: "org-1" },
  };
}

function clientActor() {
  return {
    actorType: "client" as const,
    userId: "client-1",
    role: USER_ROLES.ClientUser,
    scope: {
      kind: "client" as const,
      organizationId: "org-1",
      clientOrganizationId: "client-org-1",
      locationAccess: { kind: "all_client_locations" as const },
    },
  };
}

function managerMutationContext(
  source: WorkOrderMutationContext["source"] = "intake_review",
  userId = "manager-1",
): WorkOrderMutationContext {
  return {
    organizationId: "org-1",
    actor: {
      actorType: "internal",
      userId,
      role: USER_ROLES.Manager,
      scope: { kind: "internal", organizationId: "org-1" },
    },
    source,
  };
}

function coordinatorMutationContext(
  source: WorkOrderMutationContext["source"] = "intake_review",
  userId = "user-1",
): WorkOrderMutationContext {
  return {
    organizationId: "org-1",
    actor: {
      actorType: "internal",
      userId,
      role: USER_ROLES.Coordinator,
      scope: { kind: "internal", organizationId: "org-1" },
    },
    source,
  };
}

function systemMutationContext(): WorkOrderMutationContext {
  return {
    organizationId: "org-1",
    actor: {
      actorType: "system",
      userId: "system",
      role: "system",
      scope: { kind: "system", organizationId: "org-1", trusted: true },
    },
    source: "system_runtime",
  };
}

function upsertById<T extends { id: string }>(items: T[], entity: T) {
  const index = items.findIndex((item) => item.id === entity.id);
  if (index >= 0) {
    items[index] = entity;
    return;
  }
  items.push(entity);
}

function listWorkOrders(
  store: Map<string, WorkOrder>,
  predicate: (item: WorkOrder) => boolean,
) {
  const items = [...store.values()].filter(predicate);
  return { items, count: items.length };
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
    name: "Store 101",
    displayName: "Store 101",
    code: "101",
    storeNumber: "101",
    status: "active",
    primaryContactId: null,
    siteContactId: "contact-1",
    addressLine1: "123 Main St",
    addressLine2: null,
    city: "Toronto",
    region: "ON",
    postalCode: "M1M1M1",
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
  return "2026-05-06T10:00:00.000Z";
}
