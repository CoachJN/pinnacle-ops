import type { CommunicationVisibility } from "@/modules/communications";
import type {
  NormalizedEmailAddress,
  NormalizedEmailMessage,
  NormalizedEmailThread,
  ProviderAttachmentReference,
  ProviderKey,
} from "@/modules/providers";
import type { EventActor } from "@/server/events/types";
import type { EntityId, IsoDateTimeString, RecordStatus } from "@/types/entity";
import type { WorkOrderPriority, WorkOrderStatus } from "@/types/work-order";

export const INTAKE_SOURCE_TYPES = {
  CommunicationMessage: "communication_message",
  PortalSubmission: "portal_submission",
  InternalManual: "internal_manual",
  SystemGenerated: "system_generated",
  Email: "email",
  Sms: "sms",
  Voicemail: "voicemail",
  Ocr: "ocr",
  Attachment: "attachment",
  Transcript: "transcript",
} as const;

export type IntakeSourceType =
  (typeof INTAKE_SOURCE_TYPES)[keyof typeof INTAKE_SOURCE_TYPES];

export const INTAKE_EVENT_STATUSES = {
  Received: "received",
  Drafted: "drafted",
  UnderReview: "under_review",
  Approved: "approved",
  Rejected: "rejected",
  Merged: "merged",
  Escalated: "escalated",
  Converted: "converted",
} as const;

export type IntakeEventStatus =
  (typeof INTAKE_EVENT_STATUSES)[keyof typeof INTAKE_EVENT_STATUSES];

export const INTAKE_ARTIFACT_KINDS = {
  NormalizedContent: "normalized_content",
  StructuredSubmission: "structured_submission",
  AttachmentReference: "attachment_reference",
  Transcript: "transcript",
  OcrText: "ocr_text",
  ExtractedSnippet: "extracted_snippet",
} as const;

export type IntakeArtifactKind =
  (typeof INTAKE_ARTIFACT_KINDS)[keyof typeof INTAKE_ARTIFACT_KINDS];

export const AI_INTAKE_REVIEW_STATUSES = {
  PendingReview: "pending_review",
  UnderReview: "under_review",
  Approved: "approved",
  ApprovedWithEdits: "approved_with_edits",
  Rejected: "rejected",
  MergedIntoExisting: "merged_into_existing",
  Escalated: "escalated",
  Converted: "converted",
} as const;

export type AiIntakeReviewStatus =
  (typeof AI_INTAKE_REVIEW_STATUSES)[keyof typeof AI_INTAKE_REVIEW_STATUSES];

export const INTAKE_ESCALATION_STATES = {
  None: "none",
  Requested: "requested",
  Escalated: "escalated",
} as const;

export type IntakeEscalationState =
  (typeof INTAKE_ESCALATION_STATES)[keyof typeof INTAKE_ESCALATION_STATES];

export const INTAKE_DUPLICATE_RISK_LEVELS = {
  None: "none",
  Low: "low",
  Medium: "medium",
  High: "high",
} as const;

export type IntakeDuplicateRiskLevel =
  (typeof INTAKE_DUPLICATE_RISK_LEVELS)[keyof typeof INTAKE_DUPLICATE_RISK_LEVELS];

export const INTAKE_REVIEW_DECISIONS = {
  Approve: "approve",
  ApproveWithEdits: "approve_with_edits",
  Reject: "reject",
  MergeIntoExisting: "merge_into_existing",
  Escalate: "escalate",
} as const;

export type IntakeReviewDecision =
  (typeof INTAKE_REVIEW_DECISIONS)[keyof typeof INTAKE_REVIEW_DECISIONS];

export const INTAKE_DUPLICATE_WORKFLOW_DECISIONS = {
  MergeIntoExisting: "merge_into_existing",
  FalsePositive: "false_positive",
  Escalate: "escalate",
  CreateNew: "create_new",
} as const;

export type IntakeDuplicateWorkflowDecision =
  (typeof INTAKE_DUPLICATE_WORKFLOW_DECISIONS)[keyof typeof INTAKE_DUPLICATE_WORKFLOW_DECISIONS];

export type IntakeFieldName =
  | "title"
  | "description"
  | "priority"
  | "category"
  | "location"
  | "client"
  | "contacts"
  | "trade"
  | "urgency"
  | "suggestedLifecycle";

export interface IntakeSourceReference {
  sourceType: IntakeSourceType;
  externalSourceId: string | null;
  communicationThreadId: EntityId | null;
  communicationMessageId: EntityId | null;
  attachmentId: EntityId | null;
  portalSubmissionId: string | null;
  metadata: Record<string, unknown>;
}

export interface IntakeAttachmentReference {
  id: EntityId;
  communicationAttachmentId: EntityId | null;
  sourceAttachmentId: string | null;
  fileName: string;
  contentType: string | null;
  sizeBytes: number | null;
  storagePath: string | null;
  uploadedAt: IsoDateTimeString | null;
  metadata: Record<string, unknown>;
}

export interface IntakeArtifactReference {
  artifactId: EntityId;
  kind: IntakeArtifactKind;
  label: string | null;
}

export interface IntakeEvidence {
  id: EntityId;
  field: IntakeFieldName | "duplicate_match" | "summary";
  sourceType: IntakeSourceType;
  confidence: number;
  artifactId: EntityId | null;
  communicationMessageId: EntityId | null;
  attachmentId: EntityId | null;
  excerpt: string;
  startOffset: number | null;
  endOffset: number | null;
  rationale: string | null;
  metadata: Record<string, unknown>;
}

export interface IntakeCandidate {
  id: EntityId;
  entityType: "client" | "location" | "contact" | "trade" | "work_order";
  entityId: EntityId | null;
  label: string;
  confidence: number;
  rationale: string | null;
  metadata: Record<string, unknown>;
}

export interface DuplicateMatchCandidate {
  id: EntityId;
  candidateWorkOrderId: EntityId;
  candidateWorkOrderNumber: string | null;
  confidence: number;
  rationale: string | null;
  status: "pending_review" | "merged" | "false_positive" | "rejected";
  metadata: Record<string, unknown>;
}

export interface NormalizedMessageContent {
  subject: string | null;
  body: string;
  plainTextBody: string;
  normalizedText: string;
  preview: string | null;
}

export interface NormalizedSenderMetadata {
  displayName: string | null;
  email: string | null;
  phone: string | null;
  externalParticipantId: string | null;
  metadata: Record<string, unknown>;
}

export interface NormalizedThreadReference {
  threadId: string | null;
  parentMessageId: string | null;
  conversationKey: string | null;
  messageKey: string | null;
}

export interface NormalizedProviderMetadata {
  providerKey: ProviderKey;
  providerType: "email" | "sms" | "portal" | "voicemail" | "ocr" | "attachment_extraction";
  providerConnectionId: EntityId | null;
  providerAccountId: string | null;
  providerTenantId: string | null;
  externalMessageId: string | null;
  externalInternetMessageId: string | null;
  externalThreadId: string | null;
  externalConversationId: string | null;
  metadata: Record<string, unknown>;
}

export interface NormalizedAttachmentMetadata {
  id: EntityId;
  fileName: string;
  contentType: string | null;
  sizeBytes: number | null;
  storagePath: string | null;
  externalAttachmentId: string | null;
  uploadedAt: IsoDateTimeString | null;
  metadata: Record<string, unknown>;
}

export interface NormalizedIngestionPayload {
  sourceType: Extract<
    IntakeSourceType,
    "communication_message" | "portal_submission" | "email" | "sms" | "voicemail" | "ocr" | "attachment" | "transcript"
  >;
  channel:
    | "email"
    | "sms"
    | "portal"
    | "voicemail"
    | "ocr"
    | "attachment_extraction";
  receivedAt: IsoDateTimeString;
  sentAt: IsoDateTimeString | null;
  message: NormalizedMessageContent;
  sender: NormalizedSenderMetadata | null;
  recipients: NormalizedSenderMetadata[];
  attachments: NormalizedAttachmentMetadata[];
  thread: NormalizedThreadReference;
  provider: NormalizedProviderMetadata;
  organizationId: EntityId;
  summary: string | null;
  emailMessage?: NormalizedEmailMessage;
  emailThread?: NormalizedEmailThread;
  emailSender?: NormalizedEmailAddress | null;
  emailRecipients?: NormalizedEmailAddress[];
  emailCc?: NormalizedEmailAddress[];
  emailBcc?: NormalizedEmailAddress[];
  emailAttachments?: ProviderAttachmentReference[];
  metadata: Record<string, unknown>;
}

interface IntakeBaseEntity {
  id: EntityId;
  organizationId: EntityId;
  recordStatus: RecordStatus;
  isDeleted: boolean;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  createdByUserId: EntityId;
  updatedByUserId: EntityId;
  deletedAt?: IsoDateTimeString | null;
  deletedByUserId?: EntityId | null;
}

export interface IntakeEvent extends IntakeBaseEntity {
  tenantId: EntityId;
  status: IntakeEventStatus;
  visibility: CommunicationVisibility[];
  source: IntakeSourceReference;
  summary: string | null;
  relatedWorkOrderId: EntityId | null;
  artifactIds: EntityId[];
  latestDraftId: EntityId | null;
  latestDecisionId: EntityId | null;
  receivedAt: IsoDateTimeString;
  createdAt: IsoDateTimeString;
  createdByActor: EventActor;
  updatedAt: IsoDateTimeString;
}

export interface IntakeArtifact extends IntakeBaseEntity {
  tenantId: EntityId;
  intakeEventId: EntityId;
  kind: IntakeArtifactKind;
  visibility: CommunicationVisibility[];
  isImmutable: true;
  source: IntakeSourceReference;
  normalizedContent: string;
  rawContent: string | null;
  structuredMetadata: Record<string, unknown>;
  attachmentReferences: IntakeAttachmentReference[];
  communicationThreadId: EntityId | null;
  communicationMessageId: EntityId | null;
  createdByActor: EventActor;
}

export interface AiIntakeDraft extends IntakeBaseEntity {
  tenantId: EntityId;
  intakeEventId: EntityId;
  artifactIds: EntityId[];
  reviewStatus: AiIntakeReviewStatus;
  extractedTitle: string | null;
  extractedDescription: string | null;
  extractedPriority: WorkOrderPriority | null;
  extractedCategory: string | null;
  extractedLocation: IntakeCandidate | null;
  extractedClient: IntakeCandidate | null;
  extractedContacts: IntakeCandidate[];
  extractedTrade: string | null;
  extractedUrgency: string | null;
  extractedSuggestedLifecycle: WorkOrderStatus | null;
  overallConfidence: number;
  perFieldConfidence: Partial<Record<IntakeFieldName, number>>;
  evidence: IntakeEvidence[];
  evidenceReferences: EntityId[];
  extractedSnippets: string[];
  locationCandidates: IntakeCandidate[];
  contactCandidates: IntakeCandidate[];
  duplicateCandidates: DuplicateMatchCandidate[];
  workOrderMatchSuggestions: IntakeCandidate[];
  aiModel: string;
  aiPromptVersion: string;
  aiRunId: string;
  generatedAt: IsoDateTimeString;
  assignedReviewerUserId: EntityId | null;
  assignedAt: IsoDateTimeString | null;
  reviewStartedAt: IsoDateTimeString | null;
  lastReviewedAt: IsoDateTimeString | null;
  escalationState: IntakeEscalationState;
  escalatedToUserId: EntityId | null;
  escalatedAt: IsoDateTimeString | null;
  reviewerUserId: EntityId | null;
  reviewerDecision: IntakeReviewDecision | null;
  reviewerNotes: string | null;
  approvedWorkOrderId: EntityId | null;
  rejectedReason: string | null;
  mergedIntoWorkOrderId: EntityId | null;
  createdByActor: EventActor;
}

export interface ApprovedIntakeWorkOrderInput {
  title: string;
  description: string;
  priority: WorkOrderPriority;
  clientOrganizationId: EntityId;
  locationId: EntityId;
  requestedByContactId: EntityId | null;
  requestedByName: string | null;
  requestedByEmail: string | null;
  requestedByPhone: string | null;
  requestedServiceDate: IsoDateTimeString | null;
  category: string | null;
  coordinatorUserId: EntityId | null;
  managerUserId: EntityId | null;
}

export interface IntakeApproval extends IntakeBaseEntity {
  tenantId: EntityId;
  intakeEventId: EntityId;
  aiIntakeDraftId: EntityId;
  reviewerUserId: EntityId;
  decision: Extract<
    IntakeReviewDecision,
    "approve" | "approve_with_edits" | "merge_into_existing"
  >;
  reviewerNotes: string | null;
  approvedInput: ApprovedIntakeWorkOrderInput | null;
  approvedWorkOrderId: EntityId | null;
  mergedIntoWorkOrderId: EntityId | null;
  duplicateResolution: {
    candidateIds: EntityId[];
    falsePositiveIds: EntityId[];
  };
  createdByActor: EventActor;
}

export interface IntakeDecision extends IntakeBaseEntity {
  tenantId: EntityId;
  intakeEventId: EntityId;
  aiIntakeDraftId: EntityId;
  reviewerUserId: EntityId;
  decision: IntakeReviewDecision;
  notes: string | null;
  approvedWorkOrderId: EntityId | null;
  mergedIntoWorkOrderId: EntityId | null;
  rejectedReason: string | null;
  escalatedToUserId: EntityId | null;
  createdByActor: EventActor;
  metadata: Record<string, unknown>;
}

export interface IntakeReviewQueueItem {
  intakeEventId: EntityId;
  aiIntakeDraftId: EntityId;
  organizationId: EntityId;
  sourceType: IntakeSourceType;
  reviewStatus: AiIntakeReviewStatus;
  assignedReviewerUserId: EntityId | null;
  escalationState: IntakeEscalationState;
  duplicateRisk: IntakeDuplicateRiskLevel;
  summary: string;
  overallConfidence: number;
  duplicateCandidateCount: number;
  urgency: string | null;
  lifecycleRecommendation: WorkOrderStatus | null;
  generatedAt: IsoDateTimeString;
  createdAt: IsoDateTimeString;
  latestDecisionAt: IsoDateTimeString | null;
  relatedWorkOrderId: EntityId | null;
}
