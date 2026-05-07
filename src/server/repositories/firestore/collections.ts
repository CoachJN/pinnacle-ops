import "server-only";

export const FIRESTORE_COLLECTIONS = {
  userProfiles: "userProfiles",
  contacts: "contacts",
  clientOrganizations: "clientOrganizations",
  clientOrganizationContactLinks: "clientOrganizationContactLinks",
  locations: "locations",
  locationContactLinks: "locationContactLinks",
  contractorOrganizations: "contractorOrganizations",
  contractorContactLinks: "contractorContactLinks",
  workOrders: "workOrders",
  contractorQuotes: "contractorQuotes",
  clientQuotes: "clientQuotes",
  quotes: "quotes",
  invoices: "invoices",
  assignments: "assignments",
  activityLogs: "activityLogs",
  domainEvents: "domainEvents",
  transitionEvents: "transitionEvents",
  transitionAudits: "transitionAudits",
  intakeEvents: "intakeEvents",
  intakeArtifacts: "intakeArtifacts",
  aiIntakeDrafts: "aiIntakeDrafts",
  intakeApprovals: "intakeApprovals",
  intakeDecisions: "intakeDecisions",
  communicationThreads: "communicationThreads",
  communicationMessages: "communicationMessages",
  communicationParticipants: "communicationParticipants",
  communicationLinks: "communicationLinks",
  communicationAttachments: "communicationAttachments",
  communicationMatchSuggestions: "communicationMatchSuggestions",
  providerConnections: "providerConnections",
  providerSyncCheckpoints: "providerSyncCheckpoints",
  providerSyncRuns: "providerSyncRuns",
  providerMessageReceipts: "providerMessageReceipts",
  providerThreadMappings: "providerThreadMappings",
  runtimeJobs: "runtimeJobs",
  runtimeDeadLetters: "runtimeDeadLetters",
  runtimeEventProcessings: "runtimeEventProcessings",
  deliveryPlans: "deliveryPlans",
  deliveryAttempts: "deliveryAttempts",
  escalationOrchestrations: "escalationOrchestrations",
  slaTimers: "slaTimers",
  slaScanCursors: "slaScanCursors",
  internalNotifications: "internalNotifications",
} as const;

export type FirestoreCollectionName =
  (typeof FIRESTORE_COLLECTIONS)[keyof typeof FIRESTORE_COLLECTIONS];

export const FIRESTORE_COLLECTION_STRATEGY = {
  userProfiles:
    "Top-level user profile documents keyed by Firebase Auth uid or an explicit app user id.",
  contacts:
    "Top-level persisted contact documents scoped to an organization and reused through normalized links.",
  clientOrganizations:
    "Top-level client organization documents for reporting and organization filters.",
  clientOrganizationContactLinks:
    "Top-level normalized links between client organizations and canonical contacts.",
  locations:
    "Top-level location documents with clientOrganizationId for cross-client filtering.",
  locationContactLinks:
    "Top-level normalized links between locations and canonical contacts.",
  contractorOrganizations:
    "Top-level contractor organization documents for assignment and vendor reporting.",
  contractorContactLinks:
    "Top-level normalized links between contractor organizations and canonical contacts.",
  workOrders:
    "Top-level work order documents. Critical workflow entities are not nested.",
  contractorQuotes:
    "Top-level contractor quote documents keyed by workOrderId and contractorOrganizationId for quote intake and review.",
  clientQuotes:
    "Top-level client-facing quote documents keyed by workOrderId for client approval workflow and action gating.",
  quotes:
    "Top-level quote documents keyed by workOrderId and contractorOrganizationId for queues.",
  invoices:
    "Top-level invoice documents keyed by workOrderId and clientOrganizationId for finance queues.",
  assignments:
    "Top-level assignment documents keyed by workOrderId and contractorOrganizationId.",
  activityLogs:
    "Top-level immutable activity records keyed by workOrderId for audit/reporting.",
  domainEvents:
    "Top-level append-only operational event records keyed by workOrderId for canonical timeline and future automation.",
  transitionEvents:
    "Top-level append-only lifecycle transition event records keyed by workOrderId for durable workflow reactions.",
  transitionAudits:
    "Top-level append-only transition audit records keyed by workOrderId for authorization, reasoning, and compliance history.",
  intakeEvents:
    "Top-level canonical intake event records for provider-agnostic intake capture before authoritative operational approval.",
  intakeArtifacts:
    "Top-level immutable intake artifact records storing normalized intake content, metadata, and source provenance.",
  aiIntakeDrafts:
    "Top-level AI-safe intake draft records with extraction output, confidence, evidence, and review-ready candidate matches.",
  intakeApprovals:
    "Top-level human approval records capturing approved intake payloads and safe conversion boundaries into canonical work orders.",
  intakeDecisions:
    "Top-level review decision records for intake approvals, rejections, merges, and escalations with durable attribution.",
  communicationThreads:
    "Top-level canonical communication thread records keyed by work order and channel for omnichannel-ready operational conversations.",
  communicationMessages:
    "Top-level immutable communication message records keyed by thread and work order for timeline-native communications.",
  communicationParticipants:
    "Top-level participant records for communication threads with actor, contact, and organization linkage.",
  communicationLinks:
    "Top-level explicit links between communications and operational entities such as work orders, quotes, invoices, assignments, and events.",
  communicationAttachments:
    "Top-level communication attachment metadata linked to immutable communication messages.",
  communicationMatchSuggestions:
    "Top-level reviewable communication match suggestions for future AI-assisted linking and triage.",
  providerConnections:
    "Top-level provider connection records for mailbox/account binding, scope tracking, and tenant-safe provider diagnostics.",
  providerSyncCheckpoints:
    "Top-level provider sync checkpoint records for replay-safe cursors and mailbox ingestion progress.",
  providerSyncRuns:
    "Top-level provider sync run records for durable sync attempt auditing, reconciliation, and recovery tooling.",
  providerMessageReceipts:
    "Top-level immutable provider message ingestion receipts used for idempotency, diagnostics, and replay auditing.",
  providerThreadMappings:
    "Top-level mappings between provider-owned thread identities and canonical communication threads.",
  runtimeJobs:
    "Top-level durable worker runtime job records for canonical async execution, leasing, retries, and recovery.",
  runtimeDeadLetters:
    "Top-level dead-letter records preserving exhausted or invalid worker jobs for diagnosis and operator replay decisions.",
  runtimeEventProcessings:
    "Top-level durable event subscriber processing records for idempotent event-to-job enqueue handling, failures, and replay diagnostics.",
  deliveryPlans:
    "Top-level durable delivery planning records for canonical recipient resolution, suppression, and transport execution orchestration state.",
  deliveryAttempts:
    "Top-level durable transport execution attempt records for replay-safe channel adapter execution, retries, receipts, and operator diagnostics.",
  escalationOrchestrations:
    "Top-level durable escalation orchestration records for deterministic stage progression, suppression, cancellation, and replay-safe follow-up runtime work.",
  slaTimers:
    "Top-level canonical SLA timer records for idempotent scheduling, evaluation, diagnostics, and breach history.",
  slaScanCursors:
    "Top-level durable SLA timer scan checkpoints and recent run summaries for bounded repair scanning.",
  internalNotifications:
    "Top-level internal notification records keyed by recipient user and entity for operational alerts.",
} as const satisfies Record<keyof typeof FIRESTORE_COLLECTIONS, string>;

export const FIRESTORE_ID_CONVENTIONS = {
  explicitWhenKnown:
    "Use stable external ids when there is an upstream identity, e.g. userProfiles/{firebaseAuthUid}.",
  generatedForWorkflowRecords:
    "Use Firestore generated ids for workflow records unless a domain number is already allocated.",
  documentIdNotDuplicated:
    "Persisted document shapes do not store id fields; mappers attach the document id to domain models.",
} as const;
