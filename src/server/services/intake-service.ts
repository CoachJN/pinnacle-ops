import "server-only";

import type { AccessActor } from "@/types/auth";
import type { EntityId } from "@/types/entity";
import type { WorkOrderPriority, WorkOrderStatus } from "@/types/work-order";
import type {
  AiIntakeDraft,
  AiIntakeReviewStatus,
  ApprovedIntakeWorkOrderInput,
  DuplicateMatchCandidate,
  IntakeApproval,
  IntakeAttachmentReference,
  IntakeArtifact,
  IntakeArtifactKind,
  IntakeDecision,
  IntakeDuplicateRiskLevel,
  IntakeDuplicateWorkflowDecision,
  IntakeEscalationState,
  IntakeEvent,
  IntakeEvidence,
  IntakeFieldName,
  IntakeReviewQueueItem,
  NormalizedIngestionPayload,
  IntakeReviewDecision,
  IntakeSourceReference,
} from "@/modules/intake";
import type {
  CommunicationActorReference,
  CommunicationAttachment,
  CommunicationLink,
  CommunicationMessage,
  CommunicationThread,
  CommunicationTimelineEntry,
} from "@/modules/communications";
import type {
  ProviderMessageReceipt,
  ProviderThreadMapping,
} from "@/modules/providers";
import type { EventActor, TimelineEntry } from "@/server/events/types";
import type { FirestoreRepositories, WorkOrder } from "@/server/repositories";
import { notFoundError, validationError } from "./errors";
import type { DomainEventService } from "./domain-event-service";
import type { CommunicationDomainServices } from "./communication-service";
import type { TimelineService } from "./timeline-service";
import type { WorkOrderService } from "./work-order-service";
import {
  createAuditFields,
  nowIso,
  serviceFail,
  serviceOk,
  touchAuditFields,
  type ServiceAuditContext,
  type ServiceResult,
} from "./types";

export interface CreateIntakeEventInput extends ServiceAuditContext {
  source: IntakeSourceReference;
  visibility?: IntakeEvent["visibility"];
  summary?: string | null;
  relatedWorkOrderId?: EntityId | null;
}

export interface CreateIntakeArtifactInput extends ServiceAuditContext {
  intakeEventId: EntityId;
  kind: IntakeArtifactKind;
  source: IntakeSourceReference;
  normalizedContent: string;
  rawContent?: string | null;
  structuredMetadata?: Record<string, unknown>;
  attachmentReferences?: IntakeAttachmentReference[];
  communicationThreadId?: EntityId | null;
  communicationMessageId?: EntityId | null;
  visibility?: IntakeArtifact["visibility"];
}

export interface CreateAiIntakeDraftInput extends ServiceAuditContext {
  intakeEventId: EntityId;
  artifactIds: EntityId[];
  extractedTitle?: string | null;
  extractedDescription?: string | null;
  extractedPriority?: WorkOrderPriority | null;
  extractedCategory?: string | null;
  extractedLocation?: AiIntakeDraft["extractedLocation"];
  extractedClient?: AiIntakeDraft["extractedClient"];
  extractedContacts?: AiIntakeDraft["extractedContacts"];
  extractedTrade?: string | null;
  extractedUrgency?: string | null;
  extractedSuggestedLifecycle?: WorkOrderStatus | null;
  overallConfidence: number;
  perFieldConfidence?: Partial<Record<IntakeFieldName, number>>;
  evidence?: IntakeEvidence[];
  evidenceReferences?: EntityId[];
  extractedSnippets?: string[];
  locationCandidates?: AiIntakeDraft["locationCandidates"];
  contactCandidates?: AiIntakeDraft["contactCandidates"];
  duplicateCandidates?: DuplicateMatchCandidate[];
  workOrderMatchSuggestions?: AiIntakeDraft["workOrderMatchSuggestions"];
  aiModel: string;
  aiPromptVersion: string;
  aiRunId: string;
}

export interface ScreenIntakeDuplicatesInput extends ServiceAuditContext {
  aiIntakeDraftId: EntityId;
  duplicateCandidates: DuplicateMatchCandidate[];
  workOrderMatchSuggestions?: AiIntakeDraft["workOrderMatchSuggestions"];
}

export interface ReviewAiIntakeDraftInput extends ServiceAuditContext {
  aiIntakeDraftId: EntityId;
  decision: IntakeReviewDecision;
  reviewerNotes?: string | null;
  approvedInput?: Partial<ApprovedIntakeWorkOrderInput>;
  mergedIntoWorkOrderId?: EntityId | null;
  rejectedReason?: string | null;
  escalatedToUserId?: EntityId | null;
  falsePositiveDuplicateCandidateIds?: EntityId[];
}

export interface StartIntakeReviewInput extends ServiceAuditContext {
  aiIntakeDraftId: EntityId;
}

export interface AssignIntakeReviewInput extends ServiceAuditContext {
  aiIntakeDraftId: EntityId;
  assignedReviewerUserId: EntityId | null;
}

export interface EscalateIntakeReviewInput extends ServiceAuditContext {
  aiIntakeDraftId: EntityId;
  reviewerNotes?: string | null;
  escalatedToUserId?: EntityId | null;
}

export interface ResolveIntakeDuplicateInput extends ServiceAuditContext {
  aiIntakeDraftId: EntityId;
  action: IntakeDuplicateWorkflowDecision;
  candidateIds: EntityId[];
  mergedIntoWorkOrderId?: EntityId | null;
  reviewerNotes?: string | null;
  approvedInput?: Partial<ApprovedIntakeWorkOrderInput>;
}

export interface IngestProviderPayloadInput extends ServiceAuditContext {
  payload: NormalizedIngestionPayload;
  visibility?: IntakeEvent["visibility"];
  replayMode?: "standard" | "allow_existing_success" | "retry_failed_receipt";
  replaySourceReceiptId?: EntityId | null;
}

export interface IntakeReviewContext {
  event: IntakeEvent;
  artifacts: IntakeArtifact[];
  drafts: AiIntakeDraft[];
  approvals: IntakeApproval[];
  decisions: IntakeDecision[];
  timeline: TimelineEntry[];
  linkedCommunication: {
    thread: CommunicationThread | null;
    message: CommunicationMessage | null;
    attachments: CommunicationAttachment[];
  } | null;
}

export interface IntakeEvidenceViewItem {
  evidence: IntakeEvidence;
  artifact: IntakeArtifact | null;
  communicationMessage: CommunicationMessage | null;
  attachments: CommunicationAttachment[];
}

export interface IntakeDuplicateCandidateView {
  candidate: DuplicateMatchCandidate;
  workOrder: WorkOrder | null;
  timeline: TimelineEntry[];
  communications: CommunicationTimelineEntry[];
  attachments: CommunicationAttachment[];
}

export interface ProviderIngestionResult {
  intakeEvent: IntakeEvent;
  intakeArtifact: IntakeArtifact;
  communicationThread: CommunicationThread | null;
  communicationMessage: CommunicationMessage | null;
  communicationAttachments: CommunicationAttachment[];
  providerMessageReceipt: ProviderMessageReceipt;
  providerThreadMapping: ProviderThreadMapping | null;
}

export interface IntakeEventService {
  create(input: CreateIntakeEventInput): Promise<ServiceResult<IntakeEvent>>;
  addArtifact(input: CreateIntakeArtifactInput): Promise<ServiceResult<IntakeArtifact>>;
}

export interface IntakeDraftService {
  create(input: CreateAiIntakeDraftInput): Promise<ServiceResult<AiIntakeDraft>>;
}

export interface DuplicateScreeningService {
  screen(input: ScreenIntakeDuplicatesInput): Promise<ServiceResult<AiIntakeDraft>>;
}

export interface IntakeReviewService {
  start(input: StartIntakeReviewInput): Promise<ServiceResult<AiIntakeDraft>>;
  assign(input: AssignIntakeReviewInput): Promise<ServiceResult<AiIntakeDraft>>;
  review(input: ReviewAiIntakeDraftInput): Promise<ServiceResult<{
    draft: AiIntakeDraft;
    decision: IntakeDecision;
    approval: IntakeApproval | null;
    workOrderId: EntityId | null;
  }>>;
  escalate(input: EscalateIntakeReviewInput): Promise<ServiceResult<{
    draft: AiIntakeDraft;
    decision: IntakeDecision;
  }>>;
  resolveDuplicate(
    input: ResolveIntakeDuplicateInput,
  ): Promise<ServiceResult<{
    draft: AiIntakeDraft;
    decision: IntakeDecision | null;
    approval: IntakeApproval | null;
    workOrderId: EntityId | null;
  }>>;
}

export interface IntakeQueryService {
  listReviewQueue(
    organizationId: EntityId,
    actor: AccessActor,
    filters?: IntakeReviewQueueFilters,
  ): Promise<ServiceResult<IntakeReviewQueueItem[]>>;
  getReviewContext(
    intakeEventId: EntityId,
    actor: AccessActor,
  ): Promise<ServiceResult<IntakeReviewContext>>;
  getEvidence(
    aiIntakeDraftId: EntityId,
    actor: AccessActor,
  ): Promise<ServiceResult<IntakeEvidenceViewItem[]>>;
  getDuplicateCandidates(
    aiIntakeDraftId: EntityId,
    actor: AccessActor,
  ): Promise<ServiceResult<IntakeDuplicateCandidateView[]>>;
}

export interface IntakeIngestionService {
  ingestProviderPayload(
    input: IngestProviderPayloadInput,
  ): Promise<ServiceResult<ProviderIngestionResult>>;
}

export interface IntakeReviewQueueFilters {
  reviewStatus?: AiIntakeReviewStatus;
  minimumConfidence?: number;
  maximumConfidence?: number;
  escalationState?: IntakeEscalationState;
  duplicateRisk?: IntakeDuplicateRiskLevel;
  sourceType?: IntakeEvent["source"]["sourceType"];
  assignedReviewerUserId?: EntityId;
  createdAfter?: string;
  createdBefore?: string;
  urgency?: string;
  lifecycleRecommendation?: WorkOrderStatus;
  sortBy?: "generatedAt" | "overallConfidence" | "duplicateRisk";
}

export interface IntakeDomainServices {
  events: IntakeEventService;
  drafts: IntakeDraftService;
  duplicateScreening: DuplicateScreeningService;
  review: IntakeReviewService;
  query: IntakeQueryService;
  ingestion: IntakeIngestionService;
}

export function createIntakeServices(
  repositories: Pick<
    FirestoreRepositories,
    | "aiIntakeDrafts"
    | "communicationAttachments"
    | "communicationLinks"
    | "communicationMessages"
    | "communicationParticipants"
    | "communicationThreads"
    | "intakeApprovals"
    | "intakeArtifacts"
    | "intakeDecisions"
    | "intakeEvents"
    | "providerMessageReceipts"
    | "providerThreadMappings"
    | "workOrders"
  >,
  dependencies: {
    communications: CommunicationDomainServices;
    domainEvents: DomainEventService;
    timeline: TimelineService;
    workOrders: WorkOrderService;
  },
): IntakeDomainServices {
  const services = new DefaultIntakeDomainServices(repositories, dependencies);
  return {
    events: {
      create: (input) => services.createEvent(input),
      addArtifact: (input) => services.addArtifact(input),
    },
    drafts: {
      create: (input) => services.createDraft(input),
    },
    duplicateScreening: {
      screen: (input) => services.screen(input),
    },
    review: {
      start: (input) => services.startReview(input),
      assign: (input) => services.assignReview(input),
      review: (input) => services.review(input),
      escalate: (input) => services.escalateReview(input),
      resolveDuplicate: (input) => services.resolveDuplicate(input),
    },
    query: {
      listReviewQueue: (organizationId, actor, filters) =>
        services.listReviewQueue(organizationId, actor, filters),
      getReviewContext: (intakeEventId, actor) =>
        services.getReviewContext(intakeEventId, actor),
      getEvidence: (aiIntakeDraftId, actor) =>
        services.getEvidence(aiIntakeDraftId, actor),
      getDuplicateCandidates: (aiIntakeDraftId, actor) =>
        services.getDuplicateCandidates(aiIntakeDraftId, actor),
    },
    ingestion: {
      ingestProviderPayload: (input) => services.ingestProviderPayload(input),
    },
  };
}

class DefaultIntakeDomainServices {
  constructor(
    private readonly repositories: Pick<
      FirestoreRepositories,
      | "aiIntakeDrafts"
      | "communicationAttachments"
      | "communicationLinks"
      | "communicationMessages"
      | "communicationParticipants"
      | "communicationThreads"
      | "intakeApprovals"
      | "intakeArtifacts"
      | "intakeDecisions"
      | "intakeEvents"
      | "providerMessageReceipts"
      | "providerThreadMappings"
      | "workOrders"
    >,
    private readonly dependencies: {
      communications: CommunicationDomainServices;
      domainEvents: DomainEventService;
      timeline: TimelineService;
      workOrders: WorkOrderService;
    },
  ) {}

  async createEvent(input: CreateIntakeEventInput): Promise<ServiceResult<IntakeEvent>> {
    const createdAt = input.now ?? nowIso();
    const event: IntakeEvent = {
      id: this.repositories.intakeEvents.newId(),
      ...createAuditFields(input),
      tenantId: input.organizationId,
      status: "received",
      visibility: input.visibility ?? ["internal"],
      source: input.source,
      summary: input.summary ?? null,
      relatedWorkOrderId: input.relatedWorkOrderId ?? null,
      artifactIds: [],
      latestDraftId: null,
      latestDecisionId: null,
      receivedAt: createdAt,
      createdByActor: toStoredActor(input),
      updatedAt: createdAt,
    };

    await this.repositories.intakeEvents.create(event);
    await this.dependencies.domainEvents.record({
      ...input,
      workOrderId: input.relatedWorkOrderId ?? null,
      type: "intake_event_created",
      visibility: "internal",
      lifecycleStatus: null,
      entity: { entityType: "intake_event", entityId: event.id, label: null },
      summary: "Captured intake event for human review.",
      payload: {
        intakeEventId: event.id,
        sourceType: event.source.sourceType,
        status: event.status,
      },
    });

    return serviceOk(event);
  }

  async addArtifact(
    input: CreateIntakeArtifactInput,
  ): Promise<ServiceResult<IntakeArtifact>> {
    const intakeEvent = await this.repositories.intakeEvents.getById(input.intakeEventId);
    if (!intakeEvent || intakeEvent.isDeleted) {
      return serviceFail(notFoundError("Intake event could not be found."));
    }
    if (intakeEvent.organizationId !== input.organizationId) {
      return serviceFail(validationError("Intake event does not belong to this organization."));
    }
    if (!input.normalizedContent.trim()) {
      return serviceFail(validationError("Normalized intake artifact content is required."));
    }

    const createdAt = input.now ?? nowIso();
    const artifact: IntakeArtifact = {
      id: this.repositories.intakeArtifacts.newId(),
      ...createAuditFields(input),
      tenantId: input.organizationId,
      intakeEventId: intakeEvent.id,
      kind: input.kind,
      visibility: input.visibility ?? intakeEvent.visibility,
      isImmutable: true,
      source: input.source,
      normalizedContent: input.normalizedContent.trim(),
      rawContent: input.rawContent ?? null,
      structuredMetadata: input.structuredMetadata ?? {},
      attachmentReferences: dedupeAttachmentReferences(input.attachmentReferences ?? []),
      communicationThreadId: input.communicationThreadId ?? null,
      communicationMessageId: input.communicationMessageId ?? null,
      createdAt,
      createdByActor: toStoredActor(input),
    };

    await this.repositories.intakeArtifacts.create(artifact);
    await this.repositories.intakeEvents.save(
      touchAuditFields(
        {
          ...intakeEvent,
          artifactIds: [...new Set([...intakeEvent.artifactIds, artifact.id])],
        },
        input,
      ),
    );

    await this.dependencies.domainEvents.record({
      ...input,
      workOrderId: intakeEvent.relatedWorkOrderId ?? null,
      type: "intake_artifact_created",
      visibility: "internal",
      lifecycleStatus: null,
      entity: { entityType: "intake_event", entityId: intakeEvent.id, label: null },
      summary: "Stored immutable intake artifact.",
      payload: {
        intakeEventId: intakeEvent.id,
        artifactId: artifact.id,
        artifactKind: artifact.kind,
      },
    });

    return serviceOk(artifact);
  }

  async createDraft(
    input: CreateAiIntakeDraftInput,
  ): Promise<ServiceResult<AiIntakeDraft>> {
    return this.createAiDraftInternal(input);
  }

  async screen(
    input: ScreenIntakeDuplicatesInput,
  ): Promise<ServiceResult<AiIntakeDraft>> {
    const draft = await this.repositories.aiIntakeDrafts.getById(input.aiIntakeDraftId);
    if (!draft || draft.isDeleted) {
      return serviceFail(notFoundError("AI intake draft could not be found."));
    }
    if (draft.organizationId !== input.organizationId) {
      return serviceFail(validationError("AI intake draft does not belong to this organization."));
    }

    const updated = touchAuditFields(
      {
        ...draft,
        duplicateCandidates: dedupeDuplicateCandidates(input.duplicateCandidates),
        workOrderMatchSuggestions: input.workOrderMatchSuggestions ?? draft.workOrderMatchSuggestions,
      },
      input,
    );

    await this.repositories.aiIntakeDrafts.save(updated);
    return serviceOk(updated);
  }

  async startReview(input: StartIntakeReviewInput): Promise<ServiceResult<AiIntakeDraft>> {
    const loaded = await this.loadReviewDraft(input.aiIntakeDraftId, input.organizationId);
    if (!loaded.ok) {
      return loaded;
    }
    if (input.actor.role === "system") {
      return serviceFail(validationError("A human reviewer is required to start review."));
    }

    const startedAt = input.now ?? nowIso();
    const nextDraft = touchAuditFields(
      {
        ...loaded.value.draft,
        reviewStatus:
          loaded.value.draft.reviewStatus === "pending_review"
            ? "under_review"
            : loaded.value.draft.reviewStatus,
        reviewStartedAt: loaded.value.draft.reviewStartedAt ?? startedAt,
      },
      input,
    );
    await this.repositories.aiIntakeDrafts.save(nextDraft);
    await this.repositories.intakeEvents.save(
      touchAuditFields(
        {
          ...loaded.value.event,
          status:
            loaded.value.event.status === "drafted"
              ? "under_review"
              : loaded.value.event.status,
        },
        input,
      ),
    );
    await this.dependencies.domainEvents.record({
      ...input,
      now: startedAt,
      workOrderId: loaded.value.event.relatedWorkOrderId ?? null,
      type: "intake_review_started",
      visibility: "internal",
      lifecycleStatus: null,
      entity: { entityType: "intake_event", entityId: loaded.value.event.id, label: null },
      summary: "Started intake review.",
      payload: {
        intakeEventId: loaded.value.event.id,
        draftId: nextDraft.id,
        reviewStatus: nextDraft.reviewStatus,
      },
    });

    return serviceOk(nextDraft);
  }

  async assignReview(input: AssignIntakeReviewInput): Promise<ServiceResult<AiIntakeDraft>> {
    const loaded = await this.loadReviewDraft(input.aiIntakeDraftId, input.organizationId);
    if (!loaded.ok) {
      return loaded;
    }
    if (input.actor.role === "system") {
      return serviceFail(validationError("A human reviewer is required to assign review."));
    }

    const assignedAt = input.now ?? nowIso();
    const nextDraft = touchAuditFields(
      {
        ...loaded.value.draft,
        assignedReviewerUserId: input.assignedReviewerUserId ?? null,
        assignedAt,
      },
      input,
    );
    await this.repositories.aiIntakeDrafts.save(nextDraft);
    await this.dependencies.domainEvents.record({
      ...input,
      now: assignedAt,
      workOrderId: loaded.value.event.relatedWorkOrderId ?? null,
      type: "intake_review_assigned",
      visibility: "internal",
      lifecycleStatus: null,
      entity: { entityType: "intake_event", entityId: loaded.value.event.id, label: null },
      summary: input.assignedReviewerUserId
        ? "Assigned intake review."
        : "Cleared intake review assignment.",
      payload: {
        intakeEventId: loaded.value.event.id,
        draftId: nextDraft.id,
        assignedReviewerUserId: input.assignedReviewerUserId ?? null,
      },
    });

    return serviceOk(nextDraft);
  }

  async review(
    input: ReviewAiIntakeDraftInput,
  ): Promise<ServiceResult<{
    draft: AiIntakeDraft;
    decision: IntakeDecision;
    approval: IntakeApproval | null;
    workOrderId: EntityId | null;
  }>> {
    const outcome = await this.completeReviewDecision(input);
    if (!outcome.ok) {
      return outcome;
    }

    return serviceOk({
      draft: outcome.value.draft,
      decision: outcome.value.decision,
      approval: outcome.value.approval,
      workOrderId: outcome.value.workOrderId,
    });
  }

  async escalateReview(
    input: EscalateIntakeReviewInput,
  ): Promise<ServiceResult<{ draft: AiIntakeDraft; decision: IntakeDecision }>> {
    const result = await this.completeReviewDecision({
      ...input,
      decision: "escalate",
      escalatedToUserId: input.escalatedToUserId ?? null,
      falsePositiveDuplicateCandidateIds: [],
    });
    if (!result.ok) {
      return result;
    }

    return serviceOk({
      draft: result.value.draft,
      decision: result.value.decision,
    });
  }

  async resolveDuplicate(
    input: ResolveIntakeDuplicateInput,
  ): Promise<ServiceResult<{
    draft: AiIntakeDraft;
    decision: IntakeDecision | null;
    approval: IntakeApproval | null;
    workOrderId: EntityId | null;
  }>> {
    const loaded = await this.loadReviewDraft(input.aiIntakeDraftId, input.organizationId);
    if (!loaded.ok) {
      return loaded;
    }
    if (input.actor.role === "system") {
      return serviceFail(validationError("A human reviewer is required for intake decisions."));
    }

    if (input.action === "false_positive") {
      const reviewedAt = input.now ?? nowIso();
      const nextDraft = touchAuditFields(
        {
          ...loaded.value.draft,
          duplicateCandidates: markFalsePositives(loaded.value.draft.duplicateCandidates, input.candidateIds),
        },
        input,
      );
      await this.repositories.aiIntakeDrafts.save(nextDraft);
      await this.dependencies.domainEvents.record({
        ...input,
        now: reviewedAt,
        workOrderId: loaded.value.event.relatedWorkOrderId ?? null,
        type: "duplicate_marked_false_positive",
        visibility: "internal",
        lifecycleStatus: null,
        entity: { entityType: "intake_event", entityId: loaded.value.event.id, label: null },
        summary: "Marked duplicate candidates as false positives.",
        payload: {
          intakeEventId: loaded.value.event.id,
          draftId: nextDraft.id,
          candidateIds: input.candidateIds,
        },
      });
      return serviceOk({
        draft: nextDraft,
        decision: null,
        approval: null,
        workOrderId: loaded.value.event.relatedWorkOrderId ?? null,
      });
    }

    if (input.action === "create_new") {
      const result = await this.completeReviewDecision({
        ...input,
        decision: input.approvedInput ? "approve_with_edits" : "approve",
        reviewerNotes: input.reviewerNotes,
        falsePositiveDuplicateCandidateIds: input.candidateIds,
        approvedInput: input.approvedInput,
      });
      if (!result.ok) {
        return result;
      }
      return serviceOk(result.value);
    }

    if (input.action === "merge_into_existing") {
      const result = await this.completeReviewDecision({
        ...input,
        decision: "merge_into_existing",
        mergedIntoWorkOrderId: input.mergedIntoWorkOrderId ?? null,
        reviewerNotes: input.reviewerNotes,
        falsePositiveDuplicateCandidateIds: input.candidateIds,
      });
      if (!result.ok) {
        return result;
      }
      return serviceOk(result.value);
    }

    const result = await this.completeReviewDecision({
      ...input,
      decision: "escalate",
      reviewerNotes: input.reviewerNotes,
      falsePositiveDuplicateCandidateIds: [],
      escalatedToUserId: null,
    });
    if (!result.ok) {
      return result;
    }
    return serviceOk(result.value);
  }

  async listReviewQueue(
    organizationId: EntityId,
    actor: AccessActor,
    filters: IntakeReviewQueueFilters = {},
  ): Promise<ServiceResult<IntakeReviewQueueItem[]>> {
    if (actor.actorType !== "internal" || actor.scope.organizationId !== organizationId) {
      return serviceOk([]);
    }

    const intakeEvents = await this.repositories.intakeEvents.listByOrganizationId(organizationId, {
      limit: 200,
    });
    const eventById = new Map(intakeEvents.items.map((event) => [event.id, event]));
    const drafts = (
      await Promise.all(
        intakeEvents.items.map((event) =>
          this.repositories.aiIntakeDrafts.listByIntakeEventId(event.id, { limit: 10 }),
        ),
      )
    )
      .flatMap((result) => result.items)
      .filter((draft) => this.matchesReviewQueueFilters(draft, eventById.get(draft.intakeEventId) ?? null, filters));

    const items: Array<IntakeReviewQueueItem | null> = await Promise.all(
      drafts.map(async (draft) => {
        const decisions = await this.repositories.intakeDecisions.listByIntakeEventId(draft.intakeEventId, { limit: 1 });
        const event = eventById.get(draft.intakeEventId);
        if (!event) {
          return null;
        }
        return {
          intakeEventId: event.id,
          aiIntakeDraftId: draft.id,
          organizationId,
          sourceType: event.source.sourceType,
          reviewStatus: draft.reviewStatus,
          assignedReviewerUserId: draft.assignedReviewerUserId,
          escalationState: draft.escalationState,
          duplicateRisk: duplicateRiskLevel(draft.duplicateCandidates),
          summary: draft.extractedTitle ?? event.summary ?? "Untitled intake",
          overallConfidence: draft.overallConfidence,
          duplicateCandidateCount: draft.duplicateCandidates.length,
          urgency: draft.extractedUrgency ?? null,
          lifecycleRecommendation: draft.extractedSuggestedLifecycle ?? null,
          generatedAt: draft.generatedAt,
          createdAt: event.receivedAt,
          latestDecisionAt: decisions.items[0]?.createdAt ?? null,
          relatedWorkOrderId: event.relatedWorkOrderId ?? null,
        } satisfies IntakeReviewQueueItem;
      }),
    );

    const queue = items.filter((item): item is IntakeReviewQueueItem => item !== null);
    queue.sort((left, right) => compareReviewQueueItems(left, right, filters.sortBy ?? "generatedAt"));
    return serviceOk(queue);
  }

  async getReviewContext(
    intakeEventId: EntityId,
    actor: AccessActor,
  ): Promise<ServiceResult<IntakeReviewContext>> {
    const event = await this.requireVisibleReviewEvent(intakeEventId, actor);
    if (!event.ok) {
      return event;
    }

    const [artifacts, drafts, approvals, decisions, timeline] = await Promise.all([
      this.repositories.intakeArtifacts.listByIntakeEventId(intakeEventId, { limit: 200 }),
      this.repositories.aiIntakeDrafts.listByIntakeEventId(intakeEventId, { limit: 200 }),
      this.repositories.intakeApprovals.listByIntakeEventId(intakeEventId, { limit: 200 }),
      this.repositories.intakeDecisions.listByIntakeEventId(intakeEventId, { limit: 200 }),
      this.dependencies.domainEvents.listTimelineForEntity(
        { entityType: "intake_event", entityId: intakeEventId, label: null },
        actor,
      ),
    ]);
    if (!timeline.ok) {
      return timeline;
    }

    const latestArtifact = artifacts.items[0] ?? null;
    const linkedCommunication = latestArtifact
      ? await this.loadLinkedCommunication(latestArtifact.communicationThreadId, latestArtifact.communicationMessageId)
      : null;

    return serviceOk({
      event: event.value,
      artifacts: artifacts.items,
      drafts: drafts.items,
      approvals: approvals.items,
      decisions: decisions.items,
      timeline: timeline.value,
      linkedCommunication,
    });
  }

  async getEvidence(
    aiIntakeDraftId: EntityId,
    actor: AccessActor,
  ): Promise<ServiceResult<IntakeEvidenceViewItem[]>> {
    const loaded = await this.requireVisibleReviewDraft(aiIntakeDraftId, actor);
    if (!loaded.ok) {
      return loaded;
    }

    const artifacts = await this.repositories.intakeArtifacts.listByIntakeEventId(loaded.value.event.id, { limit: 200 });
    const artifactById = new Map(artifacts.items.map((artifact) => [artifact.id, artifact]));
    const items = await Promise.all(
      loaded.value.draft.evidence.map(async (evidence) => {
        const message = evidence.communicationMessageId
          ? await this.repositories.communicationMessages.getById(evidence.communicationMessageId)
          : null;
        const attachments = evidence.communicationMessageId
          ? (await this.repositories.communicationAttachments.listByMessageId(evidence.communicationMessageId, { limit: 50 })).items
          : [];
        return {
          evidence,
          artifact: evidence.artifactId ? artifactById.get(evidence.artifactId) ?? null : null,
          communicationMessage: message,
          attachments,
        } satisfies IntakeEvidenceViewItem;
      }),
    );

    return serviceOk(items);
  }

  async getDuplicateCandidates(
    aiIntakeDraftId: EntityId,
    actor: AccessActor,
  ): Promise<ServiceResult<IntakeDuplicateCandidateView[]>> {
    const loaded = await this.requireVisibleReviewDraft(aiIntakeDraftId, actor);
    if (!loaded.ok) {
      return loaded;
    }

    const items = await Promise.all(
      loaded.value.draft.duplicateCandidates.map(async (candidate) => {
        const workOrder = await this.repositories.workOrders.getById(candidate.candidateWorkOrderId);
        const timeline = workOrder
          ? await this.dependencies.timeline.listForWorkOrder(workOrder.id, actor)
          : serviceOk([] as TimelineEntry[]);
        const communications = workOrder
          ? await this.dependencies.communications.query.listTimelineForWorkOrder(workOrder.id, actor)
          : serviceOk([] as CommunicationTimelineEntry[]);
        const attachments = workOrder
          ? (await this.repositories.communicationAttachments.listByWorkOrderId(workOrder.id, { limit: 50 })).items
          : [];
        return {
          candidate,
          workOrder,
          timeline: timeline.ok ? timeline.value.slice(0, 20) : [],
          communications: communications.ok ? communications.value.slice(0, 20) : [],
          attachments,
        } satisfies IntakeDuplicateCandidateView;
      }),
    );

    return serviceOk(items);
  }

  async ingestProviderPayload(
    input: IngestProviderPayloadInput,
  ): Promise<ServiceResult<ProviderIngestionResult>> {
    const receivedAt = input.payload.receivedAt ?? input.now ?? nowIso();
    const visibility = input.visibility ?? ["internal"];
    const fingerprint = buildProviderMessageFingerprint(input.payload);
    const duplicateReceipt = await this.findExistingProviderReceipt(input.organizationId, input.payload, fingerprint);

    if (duplicateReceipt) {
      if (
        (duplicateReceipt.status === "failed" || duplicateReceipt.status === "rejected") &&
        input.replayMode !== "retry_failed_receipt"
      ) {
        return serviceFail(
          validationError(
            duplicateReceipt.failureReason ?? "Provider payload previously failed ingestion.",
          ),
        );
      }

      await this.repositories.providerMessageReceipts.save({
        ...duplicateReceipt,
        metadata: {
          ...duplicateReceipt.metadata,
          duplicateDetectedAt: receivedAt,
          duplicateReplayMode: input.replayMode ?? "standard",
        },
      });

      await this.dependencies.domainEvents.record({
        ...input,
        now: receivedAt,
        workOrderId: null,
        type: "provider_duplicate_detected",
        visibility: "internal",
        lifecycleStatus: null,
        entity: {
          entityType: "provider_message_receipt",
          entityId: duplicateReceipt.id,
          label: input.payload.provider.externalMessageId ?? input.payload.provider.externalInternetMessageId,
        },
        summary: "Skipped duplicate provider message during ingestion.",
        payload: {
          messageReceiptId: duplicateReceipt.id,
          canonicalMessageId: duplicateReceipt.canonicalMessageId,
          reason: "existing_provider_receipt",
        },
      });
      return this.hydrateExistingProviderIngestionResult(duplicateReceipt);
    }

    if (!input.payload.message.body.trim()) {
      const receipt = await this.createProviderReceipt({
        organizationId: input.organizationId,
        payload: input.payload,
        fingerprint,
        visibility,
        receivedAt,
        status: "rejected",
        failureReason: "Provider payload body is required for email ingestion.",
        canonicalThreadId: null,
        canonicalMessageId: null,
        intakeEventId: null,
        attachmentIds: [],
        replaySourceReceiptId: input.replaySourceReceiptId ?? null,
      });
      await this.dependencies.domainEvents.record({
        ...input,
        now: receivedAt,
        workOrderId: null,
        type: "provider_ingestion_rejected",
        visibility: "internal",
        lifecycleStatus: null,
        entity: {
          entityType: "provider_message_receipt",
          entityId: receipt.id,
          label: input.payload.provider.externalMessageId ?? null,
        },
        summary: "Rejected malformed provider message.",
        payload: {
          messageReceiptId: receipt.id,
          providerKey: input.payload.provider.providerKey,
          reason: receipt.failureReason ?? "rejected",
        },
      });
      return serviceFail(validationError("Provider payload body is required for email ingestion."));
    }

    try {
      const source = toIngestionSourceReference(input.payload);
      const intakeEventResult = await this.createEvent({
        ...input,
        now: receivedAt,
        source,
        visibility,
        summary: input.payload.summary ?? input.payload.message.preview ?? null,
      });
      if (!intakeEventResult.ok) {
        return intakeEventResult;
      }

      const communication = await this.createProviderCommunicationRecords(
        input,
        intakeEventResult.value.id,
        visibility,
      );
      if (!communication.ok) {
        return communication;
      }

      const attachmentReferences = communication.value.attachments.map((attachment) => ({
        id: attachment.id,
        communicationAttachmentId: attachment.id,
        sourceAttachmentId: attachment.externalAttachmentId ?? null,
        fileName: attachment.fileName,
        contentType: attachment.contentType,
        sizeBytes: attachment.sizeBytes,
        storagePath: attachment.storagePath,
        uploadedAt: attachment.createdAt,
        metadata: attachment.metadata,
      })) satisfies IntakeAttachmentReference[];

      const artifactResult = await this.addArtifact({
        ...input,
        now: receivedAt,
        intakeEventId: intakeEventResult.value.id,
        kind: "normalized_content",
        source: {
          ...source,
          communicationThreadId: communication.value.thread?.id ?? null,
          communicationMessageId: communication.value.message?.id ?? null,
        },
        normalizedContent: input.payload.message.normalizedText,
        rawContent: JSON.stringify(input.payload),
        structuredMetadata: {
          provider: input.payload.provider,
          sender: input.payload.emailSender ?? input.payload.sender,
          recipients: input.payload.emailRecipients ?? input.payload.recipients,
          cc: input.payload.emailCc ?? [],
          bcc: input.payload.emailBcc ?? [],
          thread: input.payload.emailThread ?? input.payload.thread,
          emailMessage: input.payload.emailMessage ?? null,
        },
        attachmentReferences,
        communicationThreadId: communication.value.thread?.id ?? null,
        communicationMessageId: communication.value.message?.id ?? null,
        visibility,
      });
      if (!artifactResult.ok) {
        return artifactResult;
      }

      const receipt = await this.createProviderReceipt({
        organizationId: input.organizationId,
        payload: input.payload,
        fingerprint,
        visibility,
        receivedAt,
        status: "ingested",
        failureReason: null,
        canonicalThreadId: communication.value.thread?.id ?? null,
        canonicalMessageId: communication.value.message?.id ?? null,
        intakeEventId: intakeEventResult.value.id,
        attachmentIds: communication.value.attachments.map((attachment) => attachment.id),
        replaySourceReceiptId: input.replaySourceReceiptId ?? null,
      });

      await this.dependencies.domainEvents.record({
        ...input,
        now: receivedAt,
        workOrderId: null,
        type: "provider_message_ingested",
        visibility: "internal",
        lifecycleStatus: null,
        entity: {
          entityType: "provider_message_receipt",
          entityId: receipt.id,
          label: input.payload.provider.externalMessageId ?? null,
        },
        summary: "Ingested provider message into canonical communication and intake records.",
        payload: {
          intakeEventId: intakeEventResult.value.id,
          messageReceiptId: receipt.id,
          providerKey: input.payload.provider.providerKey,
          canonicalMessageId: communication.value.message?.id ?? null,
        },
      });

      if (communication.value.threadMapping) {
        await this.dependencies.domainEvents.record({
          ...input,
          now: receivedAt,
          workOrderId: null,
          type: "provider_thread_linked",
          visibility: "internal",
          lifecycleStatus: null,
          entity: {
            entityType: "provider_thread_mapping",
            entityId: communication.value.threadMapping.id,
            label: communication.value.threadMapping.providerThreadId,
          },
          summary: "Linked provider thread to canonical communication thread.",
          payload: {
            messageReceiptId: receipt.id,
            providerThreadMappingId: communication.value.threadMapping.id,
            canonicalThreadId: communication.value.threadMapping.canonicalThreadId,
          },
        });
      }

      for (const attachment of communication.value.attachments) {
        await this.dependencies.domainEvents.record({
          ...input,
          now: attachment.createdAt,
          workOrderId: null,
          type: "provider_attachment_registered",
          visibility: "internal",
          lifecycleStatus: null,
          entity: {
            entityType: "provider_message_receipt",
            entityId: receipt.id,
            label: attachment.fileName,
          },
          summary: `Registered provider attachment ${attachment.fileName}.`,
          payload: {
            messageReceiptId: receipt.id,
            attachmentId: attachment.id,
            fileName: attachment.fileName,
          },
        });
      }

      return serviceOk({
        intakeEvent: intakeEventResult.value,
        intakeArtifact: artifactResult.value,
        communicationThread: communication.value.thread,
        communicationMessage: communication.value.message,
        communicationAttachments: communication.value.attachments,
        providerMessageReceipt: receipt,
        providerThreadMapping: communication.value.threadMapping,
      });
    } catch (error) {
      const failureReason = error instanceof Error ? error.message : "unknown_error";
      const failedReceipt = await this.createProviderReceipt({
        organizationId: input.organizationId,
        payload: input.payload,
        fingerprint,
        visibility,
        receivedAt,
        status: "failed",
        failureReason,
        canonicalThreadId: null,
        canonicalMessageId: null,
        intakeEventId: null,
        attachmentIds: [],
        replaySourceReceiptId: input.replaySourceReceiptId ?? null,
      });
      await this.dependencies.domainEvents.record({
        ...input,
        now: receivedAt,
        workOrderId: null,
        type: "provider_ingestion_failed",
        visibility: "internal",
        lifecycleStatus: null,
        entity: {
          entityType: "provider_message_receipt",
          entityId: failedReceipt.id,
          label: input.payload.provider.externalMessageId ?? null,
        },
        summary: "Provider ingestion failed before canonical completion.",
        payload: {
          providerKey: input.payload.provider.providerKey,
          reason: failureReason,
        },
      });
      throw error;
    }
  }

  private async completeReviewDecision(
    input: ReviewAiIntakeDraftInput,
  ): Promise<ServiceResult<{
    draft: AiIntakeDraft;
    decision: IntakeDecision;
    approval: IntakeApproval | null;
    workOrderId: EntityId | null;
  }>> {
    const loaded = await this.loadReviewDraft(input.aiIntakeDraftId, input.organizationId);
    if (!loaded.ok) {
      return loaded;
    }
    if (input.actor.role === "system") {
      return serviceFail(validationError("A human reviewer is required for intake decisions."));
    }
    if (input.decision === "merge_into_existing" && !input.mergedIntoWorkOrderId) {
      return serviceFail(validationError("mergedIntoWorkOrderId is required for merge decisions."));
    }

    const reviewedAt = input.now ?? nowIso();
    const decision: IntakeDecision = {
      id: this.repositories.intakeDecisions.newId(),
      ...createAuditFields(input),
      tenantId: input.organizationId,
      intakeEventId: loaded.value.event.id,
      aiIntakeDraftId: loaded.value.draft.id,
      reviewerUserId: input.actor.userId,
      decision: input.decision,
      notes: input.reviewerNotes ?? null,
      approvedWorkOrderId: null,
      mergedIntoWorkOrderId: input.mergedIntoWorkOrderId ?? null,
      rejectedReason: input.rejectedReason ?? null,
      escalatedToUserId: input.escalatedToUserId ?? null,
      createdAt: reviewedAt,
      createdByActor: toStoredActor(input),
      metadata: {},
    };

    let approval: IntakeApproval | null = null;
    let approvedWorkOrderId: EntityId | null = null;
    let nextDraftStatus: AiIntakeReviewStatus;
    let nextEventStatus: IntakeEvent["status"];

    if (input.decision === "approve" || input.decision === "approve_with_edits") {
      const approvedInput = buildApprovedWorkOrderInput(loaded.value.draft, input.approvedInput);
      if (!approvedInput.ok) {
        return approvedInput;
      }

      await this.dependencies.domainEvents.record({
        ...input,
        now: reviewedAt,
        workOrderId: loaded.value.event.relatedWorkOrderId ?? null,
        type: "intake_conversion_requested",
        visibility: "internal",
        lifecycleStatus: null,
        entity: { entityType: "intake_event", entityId: loaded.value.event.id, label: null },
        summary: "Requested intake conversion into a new work order.",
        payload: {
          intakeEventId: loaded.value.event.id,
          draftId: loaded.value.draft.id,
          decisionId: decision.id,
        },
      });

      const workOrderResult = await this.dependencies.workOrders.create({
        ...input,
        now: reviewedAt,
        title: approvedInput.value.title,
        description: approvedInput.value.description,
        priority: approvedInput.value.priority,
        clientOrganizationId: approvedInput.value.clientOrganizationId,
        locationId: approvedInput.value.locationId,
        requestedByContactId: approvedInput.value.requestedByContactId,
        requestedByName: approvedInput.value.requestedByName,
        requestedByEmail: approvedInput.value.requestedByEmail,
        requestedByPhone: approvedInput.value.requestedByPhone,
        requestedServiceDate: approvedInput.value.requestedServiceDate,
        category: approvedInput.value.category,
        coordinatorUserId: approvedInput.value.coordinatorUserId,
        managerUserId: approvedInput.value.managerUserId,
      });
      if (!workOrderResult.ok) {
        return workOrderResult;
      }

      approvedWorkOrderId = workOrderResult.value.id;
      decision.approvedWorkOrderId = approvedWorkOrderId;
      approval = {
        id: this.repositories.intakeApprovals.newId(),
        ...createAuditFields(input),
        tenantId: input.organizationId,
        intakeEventId: loaded.value.event.id,
        aiIntakeDraftId: loaded.value.draft.id,
        reviewerUserId: input.actor.userId,
        decision: input.decision,
        reviewerNotes: input.reviewerNotes ?? null,
        approvedInput: approvedInput.value,
        approvedWorkOrderId,
        mergedIntoWorkOrderId: null,
        duplicateResolution: {
          candidateIds: loaded.value.draft.duplicateCandidates.map((candidate) => candidate.id),
          falsePositiveIds: input.falsePositiveDuplicateCandidateIds ?? [],
        },
        createdAt: reviewedAt,
        createdByActor: toStoredActor(input),
      };
      nextDraftStatus = "converted";
      nextEventStatus = "converted";
    } else if (input.decision === "merge_into_existing") {
      approvedWorkOrderId = input.mergedIntoWorkOrderId ?? null;
      decision.mergedIntoWorkOrderId = approvedWorkOrderId;
      approval = {
        id: this.repositories.intakeApprovals.newId(),
        ...createAuditFields(input),
        tenantId: input.organizationId,
        intakeEventId: loaded.value.event.id,
        aiIntakeDraftId: loaded.value.draft.id,
        reviewerUserId: input.actor.userId,
        decision: "merge_into_existing",
        reviewerNotes: input.reviewerNotes ?? null,
        approvedInput: null,
        approvedWorkOrderId: null,
        mergedIntoWorkOrderId: approvedWorkOrderId,
        duplicateResolution: {
          candidateIds: loaded.value.draft.duplicateCandidates.map((candidate) => candidate.id),
          falsePositiveIds: input.falsePositiveDuplicateCandidateIds ?? [],
        },
        createdAt: reviewedAt,
        createdByActor: toStoredActor(input),
      };
      nextDraftStatus = "merged_into_existing";
      nextEventStatus = "merged";
    } else if (input.decision === "reject") {
      nextDraftStatus = "rejected";
      nextEventStatus = "rejected";
    } else {
      nextDraftStatus = "escalated";
      nextEventStatus = "escalated";
    }

    await this.repositories.intakeDecisions.create(decision);
    if (approval) {
      await this.repositories.intakeApprovals.create(approval);
    }

    const reviewedDraft = touchAuditFields(
      {
        ...loaded.value.draft,
        reviewStatus: nextDraftStatus,
        reviewStartedAt: loaded.value.draft.reviewStartedAt ?? reviewedAt,
        lastReviewedAt: reviewedAt,
        escalationState: (input.decision === "escalate" ? "escalated" : "none") as IntakeEscalationState,
        escalatedToUserId: input.decision === "escalate" ? input.escalatedToUserId ?? null : null,
        escalatedAt: input.decision === "escalate" ? reviewedAt : null,
        reviewerUserId: input.actor.userId,
        reviewerDecision: input.decision,
        reviewerNotes: input.reviewerNotes ?? null,
        approvedWorkOrderId,
        rejectedReason: input.rejectedReason ?? null,
        mergedIntoWorkOrderId: input.mergedIntoWorkOrderId ?? null,
        duplicateCandidates: markFalsePositives(
          loaded.value.draft.duplicateCandidates,
          input.falsePositiveDuplicateCandidateIds ?? [],
        ),
      },
      input,
    );
    await this.repositories.aiIntakeDrafts.save(reviewedDraft);

    const updatedEvent = touchAuditFields(
      {
        ...loaded.value.event,
        status: nextEventStatus,
        latestDecisionId: decision.id,
        latestDraftId: loaded.value.draft.id,
        relatedWorkOrderId: approvedWorkOrderId ?? loaded.value.event.relatedWorkOrderId ?? null,
      },
      input,
    );
    await this.repositories.intakeEvents.save(updatedEvent);

    await this.dependencies.domainEvents.record({
      ...input,
      now: reviewedAt,
      workOrderId: updatedEvent.relatedWorkOrderId ?? null,
      type: "intake_review_decision_recorded",
      visibility: "internal",
      lifecycleStatus: null,
      entity: { entityType: "intake_event", entityId: loaded.value.event.id, label: null },
      summary: `Recorded intake review decision ${input.decision}.`,
      payload: {
        intakeEventId: loaded.value.event.id,
        draftId: loaded.value.draft.id,
        decisionId: decision.id,
        reviewerDecision: input.decision,
      },
    });

    if ((input.falsePositiveDuplicateCandidateIds ?? []).length > 0) {
      await this.dependencies.domainEvents.record({
        ...input,
        now: reviewedAt,
        workOrderId: updatedEvent.relatedWorkOrderId ?? null,
        type: "duplicate_marked_false_positive",
        visibility: "internal",
        lifecycleStatus: null,
        entity: { entityType: "intake_event", entityId: loaded.value.event.id, label: null },
        summary: "Marked duplicate candidates as false positives.",
        payload: {
          intakeEventId: loaded.value.event.id,
          draftId: loaded.value.draft.id,
          candidateIds: input.falsePositiveDuplicateCandidateIds ?? [],
        },
      });
    }

    if (loaded.value.draft.duplicateCandidates.length > 0) {
      await this.dependencies.domainEvents.record({
        ...input,
        now: reviewedAt,
        workOrderId: updatedEvent.relatedWorkOrderId ?? null,
        type: "duplicate_reviewed",
        visibility: "internal",
        lifecycleStatus: null,
        entity: { entityType: "intake_event", entityId: loaded.value.event.id, label: null },
        summary: "Reviewed duplicate candidates.",
        payload: {
          intakeEventId: loaded.value.event.id,
          draftId: loaded.value.draft.id,
          candidateIds: loaded.value.draft.duplicateCandidates.map((candidate) => candidate.id),
          resolution: input.decision,
        },
      });
    }

    if (input.decision === "merge_into_existing" && approvedWorkOrderId) {
      await this.dependencies.domainEvents.record({
        ...input,
        now: reviewedAt,
        workOrderId: approvedWorkOrderId,
        type: "duplicate_merged",
        visibility: "internal",
        lifecycleStatus: null,
        entity: { entityType: "intake_event", entityId: loaded.value.event.id, label: null },
        summary: "Merged duplicate intake into an existing work order.",
        payload: {
          intakeEventId: loaded.value.event.id,
          draftId: loaded.value.draft.id,
          decisionId: decision.id,
          mergedIntoWorkOrderId: approvedWorkOrderId,
        },
      });
    }

    if (input.decision === "escalate") {
      await this.dependencies.domainEvents.record({
        ...input,
        now: reviewedAt,
        workOrderId: updatedEvent.relatedWorkOrderId ?? null,
        type: "intake_review_escalated",
        visibility: "internal",
        lifecycleStatus: null,
        entity: { entityType: "intake_event", entityId: loaded.value.event.id, label: null },
        summary: "Escalated intake review.",
        payload: {
          intakeEventId: loaded.value.event.id,
          draftId: loaded.value.draft.id,
          decisionId: decision.id,
          escalatedToUserId: input.escalatedToUserId ?? null,
        },
      });
    }

    if ((input.decision === "approve" || input.decision === "approve_with_edits") && approval && approvedWorkOrderId) {
      await this.dependencies.domainEvents.record({
        ...input,
        now: reviewedAt,
        workOrderId: approvedWorkOrderId,
        type: "intake_conversion_completed",
        visibility: "internal",
        lifecycleStatus: "new",
        entity: { entityType: "intake_event", entityId: loaded.value.event.id, label: null },
        summary: "Converted intake into a canonical work order.",
        payload: {
          intakeEventId: loaded.value.event.id,
          draftId: loaded.value.draft.id,
          approvalId: approval.id,
          approvedWorkOrderId,
        },
      });
    }

    return serviceOk({
      draft: reviewedDraft,
      decision,
      approval,
      workOrderId: approvedWorkOrderId,
    });
  }

  private async loadReviewDraft(aiIntakeDraftId: EntityId, organizationId: EntityId) {
    const draft = await this.repositories.aiIntakeDrafts.getById(aiIntakeDraftId);
    if (!draft || draft.isDeleted) {
      return serviceFail(notFoundError("AI intake draft could not be found."));
    }
    if (draft.organizationId !== organizationId) {
      return serviceFail(validationError("AI intake draft does not belong to this organization."));
    }
    const event = await this.repositories.intakeEvents.getById(draft.intakeEventId);
    if (!event || event.isDeleted) {
      return serviceFail(notFoundError("Intake event could not be found."));
    }
    return serviceOk({ draft, event });
  }

  private async requireVisibleReviewEvent(intakeEventId: EntityId, actor: AccessActor) {
    if (actor.actorType !== "internal") {
      return serviceFail(notFoundError("Intake review context could not be found."));
    }
    const event = await this.repositories.intakeEvents.getById(intakeEventId);
    if (!event || event.isDeleted || event.organizationId !== actor.scope.organizationId) {
      return serviceFail(notFoundError("Intake review context could not be found."));
    }
    return serviceOk(event);
  }

  private async requireVisibleReviewDraft(aiIntakeDraftId: EntityId, actor: AccessActor) {
    if (actor.actorType !== "internal") {
      return serviceFail(notFoundError("Intake review context could not be found."));
    }
    const loaded = await this.loadReviewDraft(aiIntakeDraftId, actor.scope.organizationId);
    if (!loaded.ok) {
      return serviceFail(notFoundError("Intake review context could not be found."));
    }
    return loaded;
  }

  private matchesReviewQueueFilters(
    draft: AiIntakeDraft,
    event: IntakeEvent | null,
    filters: IntakeReviewQueueFilters,
  ): boolean {
    if (!event) {
      return false;
    }
    const activeStatuses: readonly AiIntakeReviewStatus[] = ["pending_review", "under_review", "escalated"];
    if (filters.reviewStatus) {
      if (draft.reviewStatus !== filters.reviewStatus) {
        return false;
      }
    } else if (!activeStatuses.includes(draft.reviewStatus)) {
      return false;
    }
    if (filters.minimumConfidence != null && draft.overallConfidence < filters.minimumConfidence) {
      return false;
    }
    if (filters.maximumConfidence != null && draft.overallConfidence > filters.maximumConfidence) {
      return false;
    }
    if (filters.escalationState && draft.escalationState !== filters.escalationState) {
      return false;
    }
    if (filters.duplicateRisk && duplicateRiskLevel(draft.duplicateCandidates) !== filters.duplicateRisk) {
      return false;
    }
    if (filters.sourceType && event.source.sourceType !== filters.sourceType) {
      return false;
    }
    if (filters.assignedReviewerUserId && draft.assignedReviewerUserId !== filters.assignedReviewerUserId) {
      return false;
    }
    if (filters.createdAfter && Date.parse(event.receivedAt) < Date.parse(filters.createdAfter)) {
      return false;
    }
    if (filters.createdBefore && Date.parse(event.receivedAt) > Date.parse(filters.createdBefore)) {
      return false;
    }
    if (filters.urgency && draft.extractedUrgency !== filters.urgency) {
      return false;
    }
    if (filters.lifecycleRecommendation && draft.extractedSuggestedLifecycle !== filters.lifecycleRecommendation) {
      return false;
    }
    return true;
  }

  private async loadLinkedCommunication(
    threadId: EntityId | null,
    messageId: EntityId | null,
  ) {
    const thread = threadId ? await this.repositories.communicationThreads.getById(threadId) : null;
    const message = messageId ? await this.repositories.communicationMessages.getById(messageId) : null;
    const attachments = messageId
      ? (await this.repositories.communicationAttachments.listByMessageId(messageId, { limit: 50 })).items
      : [];
    return {
      thread,
      message,
      attachments,
    };
  }

  private async createProviderCommunicationRecords(
    input: IngestProviderPayloadInput,
    intakeEventId: EntityId,
    visibility: IntakeEvent["visibility"],
  ): Promise<ServiceResult<{
    thread: CommunicationThread | null;
    message: CommunicationMessage | null;
    attachments: CommunicationAttachment[];
    threadMapping: ProviderThreadMapping | null;
  }>> {
    const body = input.payload.message.body.trim();
    if (!body) {
      return serviceOk({ thread: null, message: null, attachments: [], threadMapping: null });
    }

    const createdAt = input.payload.sentAt ?? input.payload.receivedAt;
    const providerThreadId =
      input.payload.emailThread?.providerThreadId ??
      input.payload.provider.externalThreadId ??
      input.payload.thread.threadId;
    const existingThreadMapping = providerThreadId
      ? await this.repositories.providerThreadMappings.findByProviderThread({
          organizationId: input.organizationId,
          providerKey: input.payload.provider.providerKey,
          providerConnectionId: input.payload.provider.providerConnectionId,
          providerThreadId,
        })
      : null;
    const existingThread = existingThreadMapping
      ? await this.repositories.communicationThreads.getById(existingThreadMapping.canonicalThreadId)
      : null;
    const actor = toCommunicationActor(input);

    const thread: CommunicationThread = existingThread ?? {
      id: this.repositories.communicationThreads.newId(),
      organizationId: input.organizationId,
      tenantId: input.organizationId,
      workOrderId: null,
      channel: mapIngestionChannelToCommunicationChannel(input.payload.channel),
      subject: input.payload.message.subject,
      visibility,
      participantIds: [],
      relatedEventIds: [],
      linkedEntityIds: [intakeEventId],
      lastMessageId: null,
      lastMessageAt: createdAt,
      externalProvider: input.payload.provider.providerKey,
      externalThreadId: providerThreadId ?? null,
      metadata: {
        provider: input.payload.provider,
        emailThread: input.payload.emailThread ?? null,
      },
      createdAt,
      createdByActor: actor,
      updatedAt: createdAt,
    };
    if (existingThread) {
      await this.repositories.communicationThreads.save({
        ...existingThread,
        subject: existingThread.subject ?? input.payload.message.subject,
        visibility: uniqueVisibilities([...existingThread.visibility, ...visibility]),
        linkedEntityIds: [...new Set([...existingThread.linkedEntityIds, intakeEventId])],
        lastMessageAt: createdAt,
        updatedAt: createdAt,
        metadata: {
          ...existingThread.metadata,
          emailThread: input.payload.emailThread ?? existingThread.metadata.emailThread ?? null,
        },
      });
    } else {
      await this.repositories.communicationThreads.create(thread);
    }

    const referenceReceipt = await this.findReferenceReceipt(input.organizationId, input.payload);

    const message: CommunicationMessage = {
      id: this.repositories.communicationMessages.newId(),
      organizationId: input.organizationId,
      tenantId: input.organizationId,
      threadId: thread.id,
      workOrderId: null,
      referenceMessageId: referenceReceipt?.canonicalMessageId ?? null,
      channel: thread.channel,
      direction: "inbound",
      visibility,
      subject: input.payload.message.subject,
      body,
      plainTextBody: input.payload.message.plainTextBody,
      normalizedContent: input.payload.message.normalizedText,
      metadata: {
        provider: input.payload.provider,
        sender: input.payload.emailSender ?? input.payload.sender,
        recipients: input.payload.emailRecipients ?? input.payload.recipients,
        cc: input.payload.emailCc ?? [],
        bcc: input.payload.emailBcc ?? [],
        emailMessage: input.payload.emailMessage ?? null,
      },
      senderActorId: null,
      senderActorType: "system",
      senderActorRole: "system",
      participantIds: [],
      clientContactId: null,
      contractorOrganizationId: null,
      linkedEntityIds: [intakeEventId],
      relatedEventIds: [],
      sentAt: input.payload.sentAt,
      deliveredAt: null,
      readAt: null,
      externalProvider: input.payload.provider.providerKey,
      externalThreadId: providerThreadId ?? null,
      externalMessageId: input.payload.provider.externalMessageId,
      createdAt,
      createdByActor: actor,
    };
    await this.repositories.communicationMessages.create(message);

    const link: CommunicationLink = {
      id: this.repositories.communicationLinks.newId(),
      organizationId: input.organizationId,
      tenantId: input.organizationId,
      threadId: thread.id,
      messageId: message.id,
      workOrderId: null,
      entityType: "intake_event",
      entityId: intakeEventId,
      relationshipType: "primary",
      createdAt,
      createdByActor: actor,
      metadata: {
        providerThreadId,
      },
    };
    await this.repositories.communicationLinks.create(link);

    const participantRecords = this.buildProviderParticipants(input, thread.id, visibility, createdAt);
    const participantIds: EntityId[] = [];
    for (const participant of participantRecords) {
      await this.repositories.communicationParticipants.create(participant);
      participantIds.push(participant.id);
    }

    const attachments = await Promise.all(
      dedupeProviderAttachments(input.payload).map(async (attachment) => {
        const record: CommunicationAttachment = {
          id: this.repositories.communicationAttachments.newId(),
          organizationId: input.organizationId,
          tenantId: input.organizationId,
          threadId: thread.id,
          messageId: message.id,
          workOrderId: null,
          fileName: attachment.fileName,
          contentType: attachment.contentType ?? attachment.mimeType ?? null,
          sizeBytes: attachment.sizeBytes ?? 0,
          storagePath:
            attachment.storagePath ??
            `${input.payload.provider.providerKey}/${providerThreadId ?? "message"}/${attachment.id}`,
          hydrationStatus: attachment.hydrationStatus ?? "pending",
          hydratedAt: attachment.hydratedAt ?? null,
          hydrationError: attachment.hydrationError ?? null,
          contentHash: attachment.checksum ?? null,
          visibility,
          uploadedByActor: actor,
          externalProvider: input.payload.provider.providerKey,
          externalAttachmentId:
            attachment.externalAttachmentId ?? attachment.providerAttachmentId ?? null,
          metadata: {
            ...attachment.metadata,
            contentId: attachment.contentId ?? null,
            isInline: attachment.isInline ?? false,
            checksum: attachment.checksum ?? null,
          },
          createdAt: attachment.uploadedAt ?? createdAt,
        };
        await this.repositories.communicationAttachments.create(record);
        return record;
      }),
    );

    const persistedThread: CommunicationThread = {
      ...thread,
      participantIds: [...new Set([...thread.participantIds, ...participantIds])],
      linkedEntityIds: [...new Set([...thread.linkedEntityIds, intakeEventId])],
      lastMessageId: message.id,
      lastMessageAt: createdAt,
      updatedAt: createdAt,
    };
    await this.repositories.communicationThreads.save(persistedThread);

    const persistedMessage: CommunicationMessage = {
      ...message,
      participantIds,
    };
    await this.repositories.communicationMessages.save(persistedMessage);

    const threadMapping = providerThreadId
      ? await this.upsertProviderThreadMapping({
          organizationId: input.organizationId,
          providerKey: input.payload.provider.providerKey,
          providerConnectionId: input.payload.provider.providerConnectionId,
          providerThreadId,
          canonicalThreadId: persistedThread.id,
          latestProviderMessageId: input.payload.provider.externalMessageId,
          latestInternetMessageId:
            input.payload.provider.externalInternetMessageId ??
            input.payload.emailMessage?.internetMessageId ??
            null,
          latestCanonicalMessageId: persistedMessage.id,
          threadFingerprint:
            input.payload.emailThread?.threadFingerprint ??
            buildProviderThreadFingerprint(input.payload),
          metadata: {
            providerConversationId:
              input.payload.emailThread?.providerConversationId ??
              input.payload.provider.externalConversationId ??
              null,
          },
        })
      : null;

    if (!existingThread) {
      await this.dependencies.domainEvents.record({
        ...input,
        now: createdAt,
        workOrderId: null,
        type: "communication_thread_created",
        visibility: "internal",
        lifecycleStatus: null,
        entity: { entityType: "communication_thread", entityId: persistedThread.id, label: persistedThread.subject },
        summary: `Opened ${persistedThread.channel.replaceAll("_", " ")} intake thread.`,
        payload: {
          threadId: persistedThread.id,
          channel: persistedThread.channel,
          visibility: persistedThread.visibility,
        },
      });
    }
    await this.dependencies.domainEvents.record({
      ...input,
      now: createdAt,
      workOrderId: null,
      type: "communication_message_created",
      visibility: "internal",
      lifecycleStatus: null,
      entity: { entityType: "communication_message", entityId: persistedMessage.id, label: persistedMessage.subject },
      summary: summarizeInboundProviderMessage(persistedThread.channel, persistedMessage.plainTextBody),
      payload: {
        threadId: persistedThread.id,
        messageId: persistedMessage.id,
        channel: persistedMessage.channel,
        direction: persistedMessage.direction,
      },
    });
    await this.dependencies.domainEvents.record({
      ...input,
      now: createdAt,
      workOrderId: null,
      type: "communication_message_linked",
      visibility: "internal",
      lifecycleStatus: null,
      entity: { entityType: "communication_link", entityId: link.id, label: null },
      summary: "Linked communication to intake review.",
      payload: {
        messageId: persistedMessage.id,
        entityType: link.entityType,
        entityId: link.entityId,
        relationshipType: link.relationshipType,
      },
    });
    return serviceOk({
      thread: persistedThread,
      message: persistedMessage,
      attachments,
      threadMapping,
    });
  }

  private async findExistingProviderReceipt(
    organizationId: EntityId,
    payload: NormalizedIngestionPayload,
    fingerprint: string,
  ): Promise<ProviderMessageReceipt | null> {
    const byProviderMessage = await this.repositories.providerMessageReceipts.findByProviderMessage({
      organizationId,
      providerKey: payload.provider.providerKey,
      providerConnectionId: payload.provider.providerConnectionId,
      providerMessageId: payload.provider.externalMessageId,
      internetMessageId:
        payload.provider.externalInternetMessageId ?? payload.emailMessage?.internetMessageId ?? null,
    });
    if (byProviderMessage) {
      return byProviderMessage;
    }

    return this.repositories.providerMessageReceipts.findByFingerprint(organizationId, fingerprint);
  }

  private async findReferenceReceipt(
    organizationId: EntityId,
    payload: NormalizedIngestionPayload,
  ): Promise<ProviderMessageReceipt | null> {
    const internetMessageId =
      payload.emailThread?.parentInternetMessageId ??
      payload.emailMessage?.inReplyTo ??
      null;
    if (!internetMessageId) {
      return null;
    }

    return this.repositories.providerMessageReceipts.findByProviderMessage({
      organizationId,
      providerKey: payload.provider.providerKey,
      providerConnectionId: payload.provider.providerConnectionId,
      providerMessageId: null,
      internetMessageId,
    });
  }

  private async createProviderReceipt(input: {
    organizationId: EntityId;
    payload: NormalizedIngestionPayload;
    fingerprint: string;
    visibility: IntakeEvent["visibility"];
    receivedAt: string;
    status: ProviderMessageReceipt["status"];
    failureReason: string | null;
    canonicalThreadId: EntityId | null;
    canonicalMessageId: EntityId | null;
    intakeEventId: EntityId | null;
    attachmentIds: EntityId[];
    replaySourceReceiptId: EntityId | null;
  }): Promise<ProviderMessageReceipt> {
    const processedAt = input.receivedAt;
    const receipt: ProviderMessageReceipt = {
      id: this.repositories.providerMessageReceipts.newId(),
      organizationId: input.organizationId,
      tenantId: input.organizationId,
      providerKey: input.payload.provider.providerKey,
      providerConnectionId: input.payload.provider.providerConnectionId,
      providerMessageId: input.payload.provider.externalMessageId,
      internetMessageId:
        input.payload.provider.externalInternetMessageId ??
        input.payload.emailMessage?.internetMessageId ??
        null,
      providerThreadId:
        input.payload.emailThread?.providerThreadId ??
        input.payload.provider.externalThreadId ??
        input.payload.thread.threadId,
      canonicalThreadId: input.canonicalThreadId,
      canonicalMessageId: input.canonicalMessageId,
      intakeEventId: input.intakeEventId,
      attachmentIds: input.attachmentIds,
      fingerprint: input.fingerprint,
      status: input.status,
      visibility: input.visibility,
      receivedAt: input.receivedAt,
      processedAt,
      failureReason: input.failureReason,
      reviewedAt: null,
      reviewedByUserId: null,
      supersededByReceiptId: null,
      metadata: {
        providerAccountId: input.payload.provider.providerAccountId,
        providerTenantId: input.payload.provider.providerTenantId,
        externalConversationId: input.payload.provider.externalConversationId,
        replayPayload: input.payload,
        replaySourceReceiptId: input.replaySourceReceiptId,
      },
      createdAt: processedAt,
    };
    await this.repositories.providerMessageReceipts.create(receipt);
    return receipt;
  }

  private async hydrateExistingProviderIngestionResult(
    receipt: ProviderMessageReceipt,
  ): Promise<ServiceResult<ProviderIngestionResult>> {
    const intakeEvent = receipt.intakeEventId
      ? await this.repositories.intakeEvents.getById(receipt.intakeEventId)
      : null;
    const communicationThread = receipt.canonicalThreadId
      ? await this.repositories.communicationThreads.getById(receipt.canonicalThreadId)
      : null;
    const communicationMessage = receipt.canonicalMessageId
      ? await this.repositories.communicationMessages.getById(receipt.canonicalMessageId)
      : null;
    const communicationAttachments = receipt.canonicalMessageId
      ? (await this.repositories.communicationAttachments.listByMessageId(receipt.canonicalMessageId, { limit: 100 })).items
      : [];
    const threadMapping = receipt.providerThreadId
      ? await this.repositories.providerThreadMappings.findByProviderThread({
          organizationId: receipt.organizationId,
          providerKey: receipt.providerKey,
          providerConnectionId: receipt.providerConnectionId,
          providerThreadId: receipt.providerThreadId,
        })
      : null;

    if (!intakeEvent) {
      return serviceFail(notFoundError("Provider receipt could not be hydrated into an intake event."));
    }

    const artifacts = await this.repositories.intakeArtifacts.listByIntakeEventId(intakeEvent.id, { limit: 50 });
    const intakeArtifact = artifacts.items[0] ?? null;
    if (!intakeArtifact) {
      return serviceFail(notFoundError("Provider receipt could not be hydrated into an intake artifact."));
    }

    return serviceOk({
      intakeEvent,
      intakeArtifact,
      communicationThread,
      communicationMessage,
      communicationAttachments,
      providerMessageReceipt: receipt,
      providerThreadMapping: threadMapping,
    });
  }

  private async upsertProviderThreadMapping(input: {
    organizationId: EntityId;
    providerKey: ProviderThreadMapping["providerKey"];
    providerConnectionId: EntityId | null;
    providerThreadId: string;
    canonicalThreadId: EntityId;
    latestProviderMessageId: string | null;
    latestInternetMessageId: string | null;
    latestCanonicalMessageId: EntityId | null;
    threadFingerprint: string;
    metadata: Record<string, unknown>;
  }): Promise<ProviderThreadMapping> {
    const existing = await this.repositories.providerThreadMappings.findByProviderThread({
      organizationId: input.organizationId,
      providerKey: input.providerKey,
      providerConnectionId: input.providerConnectionId,
      providerThreadId: input.providerThreadId,
    });
    const now = nowIso();

    if (existing) {
      const updated: ProviderThreadMapping = {
        ...existing,
        canonicalThreadId: input.canonicalThreadId,
        latestProviderMessageId: input.latestProviderMessageId ?? existing.latestProviderMessageId,
        latestInternetMessageId: input.latestInternetMessageId ?? existing.latestInternetMessageId,
        latestCanonicalMessageId: input.latestCanonicalMessageId ?? existing.latestCanonicalMessageId,
        messageCount: existing.messageCount + 1,
        threadFingerprint: input.threadFingerprint,
        metadata: { ...existing.metadata, ...input.metadata },
        updatedAt: now,
      };
      await this.repositories.providerThreadMappings.save(updated);
      return updated;
    }

    const created: ProviderThreadMapping = {
      id: this.repositories.providerThreadMappings.newId(),
      organizationId: input.organizationId,
      tenantId: input.organizationId,
      providerKey: input.providerKey,
      providerConnectionId: input.providerConnectionId,
      providerThreadId: input.providerThreadId,
      canonicalThreadId: input.canonicalThreadId,
      latestProviderMessageId: input.latestProviderMessageId,
      latestInternetMessageId: input.latestInternetMessageId,
      latestCanonicalMessageId: input.latestCanonicalMessageId,
      messageCount: 1,
      threadFingerprint: input.threadFingerprint,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
    };
    await this.repositories.providerThreadMappings.create(created);
    return created;
  }

  private buildProviderParticipants(
    input: IngestProviderPayloadInput,
    threadId: EntityId,
    visibility: IntakeEvent["visibility"],
    createdAt: string,
  ) {
    const emailParticipants = [
      input.payload.emailSender ?? input.payload.sender,
      ...(input.payload.emailRecipients ?? input.payload.recipients),
      ...(input.payload.emailCc ?? []),
      ...(input.payload.emailBcc ?? []),
    ].filter((participant): participant is NonNullable<typeof participant> =>
      Boolean(participant?.email ?? participant?.displayName),
    );

    const seen = new Set<string>();
    return emailParticipants.flatMap((participant) => {
      const key = `${participant.email ?? "none"}|${participant.displayName ?? "unknown"}`;
      if (seen.has(key)) {
        return [];
      }
      seen.add(key);
      return [{
        id: this.repositories.communicationParticipants.newId(),
        organizationId: input.organizationId,
        tenantId: input.organizationId,
        threadId,
        workOrderId: null,
        actorType: "system" as const,
        userId: null,
        userRole: "system" as const,
        contactId: null,
        clientOrganizationId: null,
        contractorOrganizationId: null,
        displayName: participant.displayName ?? null,
        email: participant.email ?? null,
        phone: null,
        visibility,
        joinedAt: createdAt,
        metadata: participant.metadata ?? {},
      }];
    });
  }

  private async createAiDraftInternal(
    input: CreateAiIntakeDraftInput,
  ): Promise<ServiceResult<AiIntakeDraft>> {
    const intakeEvent = await this.repositories.intakeEvents.getById(input.intakeEventId);
    if (!intakeEvent || intakeEvent.isDeleted) {
      return serviceFail(notFoundError("Intake event could not be found."));
    }
    if (intakeEvent.organizationId !== input.organizationId) {
      return serviceFail(validationError("Intake event does not belong to this organization."));
    }
    if (input.artifactIds.length === 0) {
      return serviceFail(validationError("At least one intake artifact is required."));
    }

    const generatedAt = input.now ?? nowIso();
    const draft: AiIntakeDraft = {
      id: this.repositories.aiIntakeDrafts.newId(),
      ...createAuditFields(input),
      tenantId: input.organizationId,
      intakeEventId: intakeEvent.id,
      artifactIds: [...new Set(input.artifactIds)],
      reviewStatus: "pending_review",
      extractedTitle: input.extractedTitle ?? null,
      extractedDescription: input.extractedDescription ?? null,
      extractedPriority: input.extractedPriority ?? null,
      extractedCategory: input.extractedCategory ?? null,
      extractedLocation: input.extractedLocation ?? null,
      extractedClient: input.extractedClient ?? null,
      extractedContacts: input.extractedContacts ?? [],
      extractedTrade: input.extractedTrade ?? null,
      extractedUrgency: input.extractedUrgency ?? null,
      extractedSuggestedLifecycle: input.extractedSuggestedLifecycle ?? null,
      overallConfidence: input.overallConfidence,
      perFieldConfidence: input.perFieldConfidence ?? {},
      evidence: input.evidence ?? [],
      evidenceReferences: input.evidenceReferences ?? [],
      extractedSnippets: input.extractedSnippets ?? [],
      locationCandidates: input.locationCandidates ?? [],
      contactCandidates: input.contactCandidates ?? [],
      duplicateCandidates: dedupeDuplicateCandidates(input.duplicateCandidates ?? []),
      workOrderMatchSuggestions: input.workOrderMatchSuggestions ?? [],
      aiModel: input.aiModel,
      aiPromptVersion: input.aiPromptVersion,
      aiRunId: input.aiRunId,
      generatedAt,
      assignedReviewerUserId: null,
      assignedAt: null,
      reviewStartedAt: null,
      lastReviewedAt: null,
      escalationState: "none",
      escalatedToUserId: null,
      escalatedAt: null,
      reviewerUserId: null,
      reviewerDecision: null,
      reviewerNotes: null,
      approvedWorkOrderId: null,
      rejectedReason: null,
      mergedIntoWorkOrderId: null,
      createdAt: generatedAt,
      createdByActor: toStoredActor(input),
      updatedAt: generatedAt,
    };

    await this.repositories.aiIntakeDrafts.create(draft);
    await this.repositories.intakeEvents.save(
      touchAuditFields(
        {
          ...intakeEvent,
          status: "drafted",
          latestDraftId: draft.id,
        },
        input,
      ),
    );

    await this.dependencies.domainEvents.record({
      ...input,
      workOrderId: intakeEvent.relatedWorkOrderId ?? null,
      type: "ai_intake_draft_created",
      visibility: "internal",
      lifecycleStatus: null,
      entity: { entityType: "intake_event", entityId: intakeEvent.id, label: null },
      summary: "Persisted AI intake draft for human review.",
      payload: {
        intakeEventId: intakeEvent.id,
        draftId: draft.id,
        overallConfidence: draft.overallConfidence,
        aiModel: draft.aiModel,
      },
    });

    return serviceOk(draft);
  }
}

function toStoredActor(context: ServiceAuditContext): EventActor {
  if (context.actor.role === "system") {
    return {
      actorId: null,
      actorType: "system",
      actorRole: "system",
      displayName: "System",
    };
  }

  return {
    actorId: context.actor.userId,
    actorType: "user",
    actorRole: context.actor.role,
    displayName: null,
  };
}

function toCommunicationActor(context: ServiceAuditContext): CommunicationActorReference {
  if (context.actor.role === "system") {
    return {
      actorId: null,
      actorType: "system",
      actorRole: "system",
      displayName: "System",
    };
  }

  return {
    actorId: context.actor.userId,
    actorType: "user",
    actorRole: context.actor.role,
    displayName: null,
  };
}

function dedupeDuplicateCandidates(
  candidates: readonly DuplicateMatchCandidate[],
): DuplicateMatchCandidate[] {
  const seen = new Set<string>();
  const deduped: DuplicateMatchCandidate[] = [];

  for (const candidate of candidates) {
    const key = `${candidate.candidateWorkOrderId}:${candidate.confidence}:${candidate.status}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(candidate);
  }

  return deduped;
}

function dedupeAttachmentReferences(
  references: readonly IntakeAttachmentReference[],
): IntakeAttachmentReference[] {
  const seen = new Set<string>();
  return references.filter((reference) => {
    const key = `${reference.communicationAttachmentId ?? "none"}:${reference.sourceAttachmentId ?? "none"}:${reference.fileName}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function markFalsePositives(
  candidates: readonly DuplicateMatchCandidate[],
  falsePositiveIds: readonly EntityId[],
): DuplicateMatchCandidate[] {
  const rejected = new Set(falsePositiveIds);
  return candidates.map((candidate) =>
    rejected.has(candidate.id)
      ? { ...candidate, status: "false_positive" }
      : candidate,
  );
}

function duplicateRiskLevel(
  candidates: readonly DuplicateMatchCandidate[],
): IntakeDuplicateRiskLevel {
  const maxConfidence = candidates.reduce(
    (max, candidate) => Math.max(max, candidate.confidence),
    0,
  );
  if (maxConfidence >= 0.85) {
    return "high";
  }
  if (maxConfidence >= 0.65) {
    return "medium";
  }
  if (maxConfidence > 0) {
    return "low";
  }
  return "none";
}

function compareReviewQueueItems(
  left: IntakeReviewQueueItem,
  right: IntakeReviewQueueItem,
  sortBy: NonNullable<IntakeReviewQueueFilters["sortBy"]>,
) {
  if (sortBy === "overallConfidence") {
    const confidence = right.overallConfidence - left.overallConfidence;
    if (confidence !== 0) {
      return confidence;
    }
  }
  if (sortBy === "duplicateRisk") {
    const riskOrder = compareRiskLevel(right.duplicateRisk) - compareRiskLevel(left.duplicateRisk);
    if (riskOrder !== 0) {
      return riskOrder;
    }
  }
  const timeOrder = Date.parse(right.generatedAt) - Date.parse(left.generatedAt);
  if (timeOrder !== 0) {
    return timeOrder;
  }
  return right.aiIntakeDraftId.localeCompare(left.aiIntakeDraftId);
}

function compareRiskLevel(level: IntakeDuplicateRiskLevel) {
  switch (level) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

function buildProviderMessageFingerprint(
  payload: NormalizedIngestionPayload,
): string {
  return [
    payload.provider.providerKey,
    payload.provider.providerConnectionId ?? "no-connection",
    payload.provider.externalMessageId ??
      payload.provider.externalInternetMessageId ??
      payload.emailMessage?.internetMessageId ??
      payload.thread.messageKey ??
      "no-message-id",
    payload.emailThread?.providerThreadId ??
      payload.provider.externalThreadId ??
      payload.thread.threadId ??
      "no-thread-id",
    payload.message.normalizedText,
  ].join("|").toLowerCase();
}

function buildProviderThreadFingerprint(
  payload: NormalizedIngestionPayload,
): string {
  return [
    payload.provider.providerKey,
    payload.emailThread?.providerConversationId ??
      payload.provider.externalConversationId ??
      payload.thread.conversationKey ??
      "no-conversation",
    payload.message.subject ?? "no-subject",
  ].join("|").toLowerCase();
}

function uniqueVisibilities(
  visibility: readonly IntakeEvent["visibility"][number][],
): IntakeEvent["visibility"] {
  return [...new Set(visibility)];
}

function dedupeProviderAttachments(
  payload: NormalizedIngestionPayload,
): Array<{
  id: string;
  fileName: string;
  contentType: string | null;
  mimeType?: string | null;
  sizeBytes: number | null;
  storagePath: string | null;
  uploadedAt: string | null;
  externalAttachmentId: string | null;
  providerAttachmentId?: string | null;
  contentId?: string | null;
  isInline?: boolean;
  checksum?: string | null;
  hydrationStatus?: "pending" | "hydrated" | "failed" | "not_requested";
  hydratedAt?: string | null;
  hydrationError?: string | null;
  metadata: Record<string, unknown>;
}> {
  const attachments = payload.emailAttachments?.length
    ? payload.emailAttachments.map((attachment) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        contentType: attachment.mimeType ?? null,
        mimeType: attachment.mimeType ?? null,
        sizeBytes: attachment.sizeBytes,
        storagePath: attachment.storagePath,
        uploadedAt: attachment.uploadedAt,
        externalAttachmentId: attachment.providerAttachmentId ?? null,
        providerAttachmentId: attachment.providerAttachmentId ?? null,
        contentId: attachment.contentId ?? null,
        isInline: attachment.isInline,
        checksum: attachment.checksum ?? null,
        hydrationStatus: attachment.hydrationStatus,
        hydratedAt: attachment.hydratedAt,
        hydrationError: attachment.hydrationError,
        metadata: attachment.metadata ?? {},
      }))
    : payload.attachments.map((attachment) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        contentType: attachment.contentType ?? null,
        sizeBytes: attachment.sizeBytes ?? null,
        storagePath: attachment.storagePath ?? null,
        uploadedAt: attachment.uploadedAt ?? null,
        externalAttachmentId: attachment.externalAttachmentId ?? null,
        hydrationStatus: "pending" as const,
        hydratedAt: null,
        hydrationError: null,
        metadata: attachment.metadata ?? {},
      }));

  const seen = new Set<string>();
  return attachments.filter((attachment) => {
    const key = [
      attachment.externalAttachmentId ?? attachment.id,
      attachment.fileName,
      attachment.sizeBytes ?? 0,
    ].join("|");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function mapIngestionChannelToCommunicationChannel(
  channel: NormalizedIngestionPayload["channel"],
): CommunicationThread["channel"] {
  switch (channel) {
    case "email":
      return "email";
    case "sms":
      return "sms";
    case "portal":
      return "portal_message";
    case "voicemail":
      return "voicemail";
    default:
      return "system_message";
  }
}

function summarizeInboundProviderMessage(
  channel: CommunicationThread["channel"],
  body: string,
) {
  const preview = body.length > 80 ? `${body.slice(0, 77)}...` : body;
  return `${channel.replaceAll("_", " ")} intake: ${preview}`;
}

function toIngestionSourceReference(
  payload: NormalizedIngestionPayload,
): IntakeSourceReference {
  return {
    sourceType: payload.sourceType,
    externalSourceId:
      payload.provider.externalMessageId ??
      payload.provider.externalInternetMessageId ??
      payload.thread.messageKey,
    communicationThreadId: null,
    communicationMessageId: null,
    attachmentId: payload.attachments[0]?.id ?? payload.emailAttachments?.[0]?.id ?? null,
    portalSubmissionId: payload.channel === "portal" ? payload.thread.conversationKey : null,
    metadata: {
      provider: payload.provider,
      thread: payload.emailThread ?? payload.thread,
      sourceMetadata: payload.metadata,
    },
  };
}

function buildApprovedWorkOrderInput(
  draft: AiIntakeDraft,
  overrides: Partial<ApprovedIntakeWorkOrderInput> | undefined,
): ServiceResult<ApprovedIntakeWorkOrderInput> {
  const title = overrides?.title ?? draft.extractedTitle ?? null;
  const description = overrides?.description ?? draft.extractedDescription ?? null;
  const priority = overrides?.priority ?? draft.extractedPriority ?? null;
  const clientOrganizationId =
    overrides?.clientOrganizationId ?? draft.extractedClient?.entityId ?? null;
  const locationId =
    overrides?.locationId ?? draft.extractedLocation?.entityId ?? null;

  if (!title || !description || !priority || !clientOrganizationId || !locationId) {
    return serviceFail(
      validationError(
        "Approved intake requires title, description, priority, clientOrganizationId, and locationId.",
      ),
    );
  }

  return serviceOk({
    title,
    description,
    priority,
    clientOrganizationId,
    locationId,
    requestedByContactId:
      overrides?.requestedByContactId ?? draft.extractedContacts[0]?.entityId ?? null,
    requestedByName:
      overrides?.requestedByName ??
      draft.extractedContacts[0]?.label ??
      null,
    requestedByEmail: overrides?.requestedByEmail ?? null,
    requestedByPhone: overrides?.requestedByPhone ?? null,
    requestedServiceDate: overrides?.requestedServiceDate ?? null,
    category: overrides?.category ?? draft.extractedCategory ?? null,
    coordinatorUserId: overrides?.coordinatorUserId ?? null,
    managerUserId: overrides?.managerUserId ?? null,
  });
}
