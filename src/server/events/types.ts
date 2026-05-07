import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type { UserRole } from "@/types/permissions";

export const EVENT_VISIBILITIES = {
  Internal: "internal",
  Client: "client",
  Contractor: "contractor",
  Finance: "finance",
  System: "system",
} as const;

export type EventVisibility =
  (typeof EVENT_VISIBILITIES)[keyof typeof EVENT_VISIBILITIES];

export const EVENT_ACTOR_TYPES = {
  User: "user",
  System: "system",
  AI: "ai",
} as const;

export type EventActorType =
  (typeof EVENT_ACTOR_TYPES)[keyof typeof EVENT_ACTOR_TYPES];

export interface EventActor {
  actorId: EntityId | null;
  actorType: EventActorType;
  actorRole: UserRole | "system" | "ai" | null;
  displayName: string | null;
}

export interface EventEntityReference {
  entityType:
    | "work_order"
    | "assignment"
    | "quote"
    | "invoice"
    | "note"
    | "attachment"
    | "intake_event"
    | "intake_artifact"
    | "ai_intake_draft"
    | "intake_approval"
    | "intake_decision"
    | "communication_thread"
    | "communication_message"
    | "communication_attachment"
    | "communication_link"
    | "provider_connection"
    | "provider_sync_checkpoint"
    | "provider_sync_run"
    | "provider_message_receipt"
    | "provider_thread_mapping"
    | "provider_receipt"
    | "provider_webhook_event"
    | "runtime_job"
    | "runtime_dead_letter"
    | "sla_timer"
    | "escalation_orchestration"
    | "delivery_plan"
    | "delivery_attempt";
  entityId: EntityId;
  label: string | null;
}

export interface EventMetadata {
  requestId: string | null;
  reason: string | null;
  correlationId: string | null;
  details: Record<string, unknown>;
}

export const DOMAIN_EVENT_TYPES = {
  WorkOrderCreated: "work_order_created",
  LifecycleTransitioned: "lifecycle_transitioned",
  AssignmentCreated: "assignment_created",
  AssignmentAccepted: "assignment_accepted",
  AssignmentDeclined: "assignment_declined",
  ContractorContacted: "contractor_contacted",
  QuoteRequested: "quote_requested",
  ContractorQuoteReceived: "contractor_quote_received",
  ClientApprovalRequested: "client_approval_requested",
  ClientApproved: "client_approved",
  WorkStarted: "work_started",
  WorkCompleted: "work_completed",
  InvoiceSent: "invoice_sent",
  PaymentRecorded: "payment_recorded",
  WorkOrderClosed: "work_order_closed",
  WorkOrderCancelled: "work_order_cancelled",
  WorkOrderOnHold: "work_order_on_hold",
  WorkOrderEscalated: "work_order_escalated",
  NoteAdded: "note_added",
  AttachmentAdded: "attachment_added",
  CommunicationThreadCreated: "communication_thread_created",
  CommunicationMessageCreated: "communication_message_created",
  CommunicationMessageLinked: "communication_message_linked",
  CommunicationVisibilityChanged: "communication_visibility_changed",
  IntakeEventCreated: "intake_event_created",
  IntakeArtifactCreated: "intake_artifact_created",
  AiIntakeDraftCreated: "ai_intake_draft_created",
  IntakeReviewStarted: "intake_review_started",
  IntakeReviewAssigned: "intake_review_assigned",
  IntakeReviewDecisionRecorded: "intake_review_decision_recorded",
  IntakeReviewEscalated: "intake_review_escalated",
  DuplicateReviewed: "duplicate_reviewed",
  DuplicateMarkedFalsePositive: "duplicate_marked_false_positive",
  DuplicateMerged: "duplicate_merged",
  IntakeConversionRequested: "intake_conversion_requested",
  IntakeConversionCompleted: "intake_conversion_completed",
  ProviderMessageIngested: "provider_message_ingested",
  ProviderThreadLinked: "provider_thread_linked",
  ProviderAttachmentRegistered: "provider_attachment_registered",
  ProviderDuplicateDetected: "provider_duplicate_detected",
  ProviderIngestionRejected: "provider_ingestion_rejected",
  ProviderIngestionFailed: "provider_ingestion_failed",
  ProviderConnectionCreated: "provider_connection_created",
  ProviderConnectionStatusChanged: "provider_connection_status_changed",
  ProviderSyncStarted: "provider_sync_started",
  ProviderSyncCompleted: "provider_sync_completed",
  ProviderSyncFailed: "provider_sync_failed",
  ProviderReplayRequested: "provider_replay_requested",
  ProviderReplayCompleted: "provider_replay_completed",
  ProviderReconciliationCompleted: "provider_reconciliation_completed",
  ProviderWebhookReceived: "provider_webhook_received",
  ProviderReceiptRecorded: "provider_receipt_recorded",
  ProviderReceiptReconciled: "provider_receipt_reconciled",
  ProviderAttachmentHydrationStarted: "provider_attachment_hydration_started",
  ProviderAttachmentHydrationCompleted: "provider_attachment_hydration_completed",
  ProviderAttachmentHydrationFailed: "provider_attachment_hydration_failed",
  RuntimeJobQueued: "runtime_job_queued",
  RuntimeJobFailed: "runtime_job_failed",
  RuntimeJobRetryScheduled: "runtime_job_retry_scheduled",
  RuntimeJobDeadLettered: "runtime_job_dead_lettered",
  RuntimeJobSucceeded: "runtime_job_succeeded",
  RuntimeJobCancelled: "runtime_job_cancelled",
  SlaTimerBreached: "sla_timer_breached",
  SlaTimerSatisfied: "sla_timer_satisfied",
  EscalationCreated: "escalation_created",
  EscalationProgressed: "escalation_progressed",
  EscalationCancelled: "escalation_cancelled",
  EscalationSuppressed: "escalation_suppressed",
  DeliveryPlanned: "delivery_planned",
  DeliveryScheduled: "delivery_scheduled",
  DeliveryCompleted: "delivery_completed",
  DeliveryCancelled: "delivery_cancelled",
  DeliverySuppressed: "delivery_suppressed",
  TransportAttemptQueued: "transport_attempt_queued",
  TransportAttemptExecuting: "transport_attempt_executing",
  TransportAttemptSucceeded: "transport_attempt_succeeded",
  TransportAttemptFailed: "transport_attempt_failed",
  TransportAttemptRetryScheduled: "transport_attempt_retry_scheduled",
  TransportAttemptCancelled: "transport_attempt_cancelled",
  TransportAttemptSuppressed: "transport_attempt_suppressed",
  TransportAttemptNoop: "transport_attempt_noop",
  AiIntakeReviewed: "ai_intake_reviewed",
  AiIntakeApproved: "ai_intake_approved",
  AiIntakeRejected: "ai_intake_rejected",
  AiIntakeMerged: "ai_intake_merged",
  AiIntakeEscalated: "ai_intake_escalated",
} as const;

export type DomainEventType =
  (typeof DOMAIN_EVENT_TYPES)[keyof typeof DOMAIN_EVENT_TYPES];

export interface DomainEventPayloadMap {
  work_order_created: { lifecycleStatus: string; priority: string; title: string };
  lifecycle_transitioned: {
    fromLifecycleStatus: string;
    toLifecycleStatus: string;
    reason: string | null;
  };
  assignment_created: {
    assignmentId: EntityId;
    contractorOrganizationId: EntityId | null;
    status: string;
  };
  assignment_accepted: { assignmentId: EntityId; status: string };
  assignment_declined: { assignmentId: EntityId; status: string; notes: string | null };
  contractor_contacted: { assignmentId: EntityId; contractorOrganizationId: EntityId | null };
  quote_requested: { workOrderId: EntityId };
  contractor_quote_received: { quoteId: EntityId; totalAmount: number; status: string };
  client_approval_requested: { quoteId: EntityId; totalAmount: number; status: string };
  client_approved: { quoteId: EntityId; status: string };
  work_started: { fromLifecycleStatus: string };
  work_completed: { fromLifecycleStatus: string };
  invoice_sent: { invoiceId: EntityId; invoiceStatus: string; totalAmount: number };
  payment_recorded: { invoiceId: EntityId; invoiceStatus: string; paymentReference: string | null };
  work_order_closed: { fromLifecycleStatus: string };
  work_order_cancelled: { fromLifecycleStatus: string; reason: string | null };
  work_order_on_hold: { fromLifecycleStatus: string; reason: string | null };
  work_order_escalated: { fromLifecycleStatus: string; reason: string | null };
  note_added: { noteId: EntityId; noteType: string; content: string };
  attachment_added: { attachmentId: EntityId; fileName: string; contentType: string | null };
  communication_thread_created: {
    threadId: EntityId;
    channel: string;
    visibility: string[];
  };
  communication_message_created: {
    threadId: EntityId;
    messageId: EntityId;
    channel: string;
    direction: string;
  };
  communication_message_linked: {
    messageId: EntityId;
    entityType: string;
    entityId: EntityId;
    relationshipType: string;
  };
  communication_visibility_changed: {
    threadId: EntityId;
    messageId: EntityId | null;
    visibility: string[];
  };
  intake_event_created: {
    intakeEventId: EntityId;
    sourceType: string;
    status: string;
  };
  intake_artifact_created: {
    intakeEventId: EntityId;
    artifactId: EntityId;
    artifactKind: string;
  };
  ai_intake_draft_created: {
    intakeEventId: EntityId;
    draftId: EntityId;
    overallConfidence: number;
    aiModel: string;
  };
  intake_review_started: {
    intakeEventId: EntityId;
    draftId: EntityId;
    reviewStatus: string;
  };
  intake_review_assigned: {
    intakeEventId: EntityId;
    draftId: EntityId;
    assignedReviewerUserId: EntityId | null;
  };
  intake_review_decision_recorded: {
    intakeEventId: EntityId;
    draftId: EntityId;
    decisionId: EntityId;
    reviewerDecision: string;
  };
  intake_review_escalated: {
    intakeEventId: EntityId;
    draftId: EntityId;
    decisionId: EntityId;
    escalatedToUserId: EntityId | null;
  };
  duplicate_reviewed: {
    intakeEventId: EntityId;
    draftId: EntityId;
    candidateIds: EntityId[];
    resolution: string;
  };
  duplicate_marked_false_positive: {
    intakeEventId: EntityId;
    draftId: EntityId;
    candidateIds: EntityId[];
  };
  duplicate_merged: {
    intakeEventId: EntityId;
    draftId: EntityId;
    decisionId: EntityId;
    mergedIntoWorkOrderId: EntityId;
  };
  intake_conversion_requested: {
    intakeEventId: EntityId;
    draftId: EntityId;
    decisionId: EntityId;
  };
  intake_conversion_completed: {
    intakeEventId: EntityId;
    draftId: EntityId;
    approvalId: EntityId;
    approvedWorkOrderId: EntityId;
  };
  provider_message_ingested: {
    intakeEventId: EntityId;
    messageReceiptId: EntityId;
    providerKey: string;
    canonicalMessageId: EntityId | null;
  };
  provider_thread_linked: {
    messageReceiptId: EntityId;
    providerThreadMappingId: EntityId;
    canonicalThreadId: EntityId;
  };
  provider_attachment_registered: {
    messageReceiptId: EntityId;
    attachmentId: EntityId;
    fileName: string;
  };
  provider_duplicate_detected: {
    messageReceiptId: EntityId;
    canonicalMessageId: EntityId | null;
    reason: string;
  };
  provider_ingestion_rejected: {
    messageReceiptId: EntityId;
    providerKey: string;
    reason: string;
  };
  provider_ingestion_failed: {
    providerKey: string;
    reason: string;
  };
  provider_connection_created: {
    connectionId: EntityId;
    providerKey: string;
    mailboxAddress: string | null;
    status: string;
  };
  provider_connection_status_changed: {
    connectionId: EntityId;
    previousStatus: string;
    nextStatus: string;
    healthStatus: string;
  };
  provider_sync_started: {
    connectionId: EntityId;
    syncRunId: EntityId;
    checkpointId: EntityId | null;
    mailboxAddress: string | null;
    folderId: string | null;
  };
  provider_sync_completed: {
    connectionId: EntityId;
    syncRunId: EntityId;
    checkpointId: EntityId | null;
    messagesSeen: number;
    messagesIngested: number;
    duplicatesSkipped: number;
    failures: number;
  };
  provider_sync_failed: {
    connectionId: EntityId;
    syncRunId: EntityId;
    checkpointId: EntityId | null;
    reason: string;
    failures: number;
  };
  provider_replay_requested: {
    receiptId: EntityId | null;
    providerMessageId: string | null;
    providerThreadId: string | null;
  };
  provider_replay_completed: {
    receiptId: EntityId;
    replayReceiptId: EntityId;
    canonicalMessageId: EntityId | null;
  };
  provider_reconciliation_completed: {
    connectionId: EntityId | null;
    providerThreadId: string | null;
    receiptId: EntityId | null;
    status: string;
  };
  provider_webhook_received: {
    webhookEventId: EntityId;
    providerType: string;
    providerEventType: string;
    providerMessageId: string | null;
    providerReceiptId: string | null;
    normalizedStatus: string | null;
  };
  provider_receipt_recorded: {
    receiptId: EntityId;
    deliveryAttemptId: EntityId | null;
    deliveryPlanId: EntityId | null;
    providerType: string;
    normalizedStatus: string;
    sourceWebhookEventId: EntityId | null;
  };
  provider_receipt_reconciled: {
    receiptId: EntityId;
    deliveryAttemptId: EntityId | null;
    deliveryPlanId: EntityId | null;
    providerType: string;
    normalizedStatus: string;
    outcome: string;
    previousAttemptStatus: string | null;
    nextAttemptStatus: string | null;
    retrySuppressed: boolean;
  };
  provider_attachment_hydration_started: {
    attachmentId: EntityId;
    providerAttachmentId: string | null;
    providerKey: string | null;
  };
  provider_attachment_hydration_completed: {
    attachmentId: EntityId;
    contentHash: string | null;
    storagePath: string;
  };
  provider_attachment_hydration_failed: {
    attachmentId: EntityId;
    reason: string;
  };
  runtime_job_queued: {
    jobId: EntityId;
    jobType: string;
    status: string;
    attemptCount: number;
    maxAttempts: number;
    runAfter: IsoDateTimeString;
    correlationId: string;
    causationId: string;
    sourceEventId: EntityId | null;
  };
  runtime_job_failed: {
    jobId: EntityId;
    jobType: string;
    attemptCount: number;
    retryable: boolean;
    correlationId: string;
    causationId: string;
    sourceEventId: EntityId | null;
  };
  runtime_job_retry_scheduled: {
    jobId: EntityId;
    jobType: string;
    attemptCount: number;
    nextRunAfter: IsoDateTimeString;
    delayMs: number;
    correlationId: string;
    causationId: string;
    sourceEventId: EntityId | null;
  };
  runtime_job_dead_lettered: {
    jobId: EntityId;
    jobType: string;
    deadLetterRecordId: EntityId;
    attemptCount: number;
    correlationId: string;
    causationId: string;
    sourceEventId: EntityId | null;
  };
  runtime_job_succeeded: {
    jobId: EntityId;
    jobType: string;
    attemptCount: number;
    correlationId: string;
    causationId: string;
    sourceEventId: EntityId | null;
  };
  runtime_job_cancelled: {
    jobId: EntityId;
    jobType: string;
    correlationId: string;
    causationId: string;
    sourceEventId: EntityId | null;
  };
  sla_timer_breached: {
    timerId: EntityId;
    timerType: string;
    targetEntityType: string;
    targetEntityId: EntityId;
    dueAt: IsoDateTimeString;
    policyVersion: string;
  };
  sla_timer_satisfied: {
    timerId: EntityId;
    timerType: string;
    targetEntityType: string;
    targetEntityId: EntityId;
    satisfiedAt: IsoDateTimeString;
    policyVersion: string;
  };
  escalation_created: {
    orchestrationId: EntityId;
    escalationType: string;
    targetEntityType: string;
    targetEntityId: EntityId;
    sourceSlaTimerId: EntityId;
    stageNumber: number;
    stageName: string;
    status: string;
  };
  escalation_progressed: {
    orchestrationId: EntityId;
    escalationType: string;
    targetEntityType: string;
    targetEntityId: EntityId;
    sourceSlaTimerId: EntityId;
    stageNumber: number;
    stageName: string;
    status: string;
  };
  escalation_cancelled: {
    orchestrationId: EntityId;
    escalationType: string;
    targetEntityType: string;
    targetEntityId: EntityId;
    sourceSlaTimerId: EntityId;
    status: string;
    cancellationReason: string | null;
  };
  escalation_suppressed: {
    orchestrationId: EntityId;
    escalationType: string;
    targetEntityType: string;
    targetEntityId: EntityId;
    sourceSlaTimerId: EntityId;
    status: string;
    suppressedReason: string | null;
  };
  delivery_planned: {
    deliveryPlanId: EntityId;
    deliveryType: string;
    sourceEscalationId: EntityId;
    sourceEscalationStageNumber: number | null;
    targetEntityType: string;
    targetEntityId: EntityId;
    recipientType: string;
    recipientId: EntityId;
    channel: string;
    status: string;
    retryCount: number;
  };
  delivery_scheduled: {
    deliveryPlanId: EntityId;
    deliveryType: string;
    sourceEscalationId: EntityId;
    sourceEscalationStageNumber: number | null;
    targetEntityType: string;
    targetEntityId: EntityId;
    recipientType: string;
    recipientId: EntityId;
    channel: string;
    status: string;
    retryCount: number;
    nextAttemptAt: IsoDateTimeString | null;
  };
  delivery_completed: {
    deliveryPlanId: EntityId;
    deliveryType: string;
    sourceEscalationId: EntityId;
    sourceEscalationStageNumber: number | null;
    targetEntityType: string;
    targetEntityId: EntityId;
    recipientType: string;
    recipientId: EntityId;
    channel: string;
    status: string;
    retryCount: number;
  };
  delivery_cancelled: {
    deliveryPlanId: EntityId;
    deliveryType: string;
    sourceEscalationId: EntityId;
    sourceEscalationStageNumber: number | null;
    targetEntityType: string;
    targetEntityId: EntityId;
    recipientType: string;
    recipientId: EntityId;
    channel: string;
    status: string;
    retryCount: number;
    cancellationReason: string | null;
  };
  delivery_suppressed: {
    deliveryPlanId: EntityId;
    deliveryType: string;
    sourceEscalationId: EntityId;
    sourceEscalationStageNumber: number | null;
    targetEntityType: string;
    targetEntityId: EntityId;
    recipientType: string;
    recipientId: EntityId;
    channel: string;
    status: string;
    retryCount: number;
    suppressionReason: string | null;
  };
  transport_attempt_queued: {
    deliveryAttemptId: EntityId;
    deliveryPlanId: EntityId;
    deliveryType: string;
    channel: string;
    adapterType: string;
    status: string;
    retryCount: number;
  };
  transport_attempt_executing: {
    deliveryAttemptId: EntityId;
    deliveryPlanId: EntityId;
    deliveryType: string;
    channel: string;
    adapterType: string;
    status: string;
    retryCount: number;
  };
  transport_attempt_succeeded: {
    deliveryAttemptId: EntityId;
    deliveryPlanId: EntityId;
    deliveryType: string;
    channel: string;
    adapterType: string;
    status: string;
    retryCount: number;
    providerMessageId: string | null;
    providerCorrelationId: string | null;
    providerReceiptId: string | null;
  };
  transport_attempt_failed: {
    deliveryAttemptId: EntityId;
    deliveryPlanId: EntityId;
    deliveryType: string;
    channel: string;
    adapterType: string;
    status: string;
    retryCount: number;
    failureCode: string | null;
    failureReason: string | null;
  };
  transport_attempt_retry_scheduled: {
    deliveryAttemptId: EntityId;
    deliveryPlanId: EntityId;
    deliveryType: string;
    channel: string;
    adapterType: string;
    status: string;
    retryCount: number;
    nextRetryAt: IsoDateTimeString | null;
    nextAttemptNumber: number;
    failureCode: string | null;
    failureReason: string | null;
  };
  transport_attempt_cancelled: {
    deliveryAttemptId: EntityId;
    deliveryPlanId: EntityId;
    deliveryType: string;
    channel: string;
    adapterType: string;
    status: string;
    retryCount: number;
    cancellationReason?: string | null;
    reason?: string | null;
  };
  transport_attempt_suppressed: {
    deliveryAttemptId: EntityId;
    deliveryPlanId: EntityId;
    deliveryType: string;
    channel: string;
    adapterType: string;
    status: string;
    retryCount: number;
    suppressionReason?: string | null;
    reason?: string | null;
  };
  transport_attempt_noop: {
    deliveryAttemptId: EntityId;
    deliveryPlanId: EntityId;
    status: string;
    reason: string;
  };
  ai_intake_reviewed: {
    intakeEventId: EntityId;
    draftId: EntityId;
    decisionId: EntityId;
    reviewerDecision: string;
  };
  ai_intake_approved: {
    intakeEventId: EntityId;
    draftId: EntityId;
    approvalId: EntityId;
    approvedWorkOrderId: EntityId;
  };
  ai_intake_rejected: {
    intakeEventId: EntityId;
    draftId: EntityId;
    decisionId: EntityId;
    rejectedReason: string | null;
  };
  ai_intake_merged: {
    intakeEventId: EntityId;
    draftId: EntityId;
    decisionId: EntityId;
    mergedIntoWorkOrderId: EntityId;
  };
  ai_intake_escalated: {
    intakeEventId: EntityId;
    draftId: EntityId;
    decisionId: EntityId;
    escalatedToUserId: EntityId | null;
  };
}

export type DomainEventPayload<TType extends DomainEventType> =
  DomainEventPayloadMap[TType];

export interface DomainEvent<TType extends DomainEventType = DomainEventType> {
  id: EntityId;
  organizationId: EntityId;
  tenantId: EntityId;
  workOrderId: EntityId | null;
  type: TType;
  actor: EventActor;
  visibility: EventVisibility;
  occurredAt: IsoDateTimeString;
  lifecycleStatus: string | null;
  entity: EventEntityReference;
  summary: string;
  metadata: EventMetadata;
  payload: DomainEventPayload<TType>;
}

export interface TransitionEvent {
  id: EntityId;
  organizationId: EntityId;
  tenantId: EntityId;
  workOrderId: EntityId;
  actor: EventActor;
  visibility: EventVisibility;
  occurredAt: IsoDateTimeString;
  fromLifecycleStatus: string;
  toLifecycleStatus: string;
  reason: string | null;
  metadata: EventMetadata;
}

export interface TransitionAudit {
  id: EntityId;
  organizationId: EntityId;
  tenantId: EntityId;
  workOrderId: EntityId;
  actor: EventActor;
  occurredAt: IsoDateTimeString;
  fromLifecycleStatus: string;
  toLifecycleStatus: string;
  reason: string | null;
  metadata: EventMetadata;
  escalationContext: Record<string, unknown> | null;
  holdContext: Record<string, unknown> | null;
}

export interface TimelineEntry {
  id: EntityId;
  workOrderId: EntityId | null;
  occurredAt: IsoDateTimeString;
  type: DomainEventType;
  visibility: EventVisibility;
  actor: EventActor;
  summary: string;
  lifecycleStatus: string | null;
  entity: EventEntityReference;
  payload: Record<string, unknown>;
}
