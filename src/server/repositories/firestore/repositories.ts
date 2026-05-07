import "server-only";

import type {
  AiIntakeDraft,
  IntakeApproval,
  IntakeArtifact,
  IntakeDecision,
  IntakeEvent,
} from "@/modules/intake";
import type {
  CommunicationAttachment,
  CommunicationChannel,
  CommunicationMatchSuggestion,
  CommunicationMessage,
  CommunicationParticipant,
  CommunicationThread,
  CommunicationVisibility,
} from "@/modules/communications";
import type {
  ProviderConnection,
  ProviderMessageReceipt,
  ProviderSyncCheckpoint,
  ProviderSyncRun,
  ProviderThreadMapping,
} from "@/modules/providers";
import type {
  EventProcessingRecord,
  WorkerDeadLetterRecord,
  WorkerJob,
} from "@/modules/runtime";
import type { DeliveryPlan as CanonicalDeliveryPlan } from "@/modules/delivery";
import type { EscalationOrchestration } from "@/modules/escalation";
import type { DeliveryAttempt } from "@/modules/transport";
import type { SlaScanCursor, SlaTimer } from "@/modules/sla";
import type {
  CollectionReference,
  DocumentData,
  Firestore,
  Query,
  QueryDocumentSnapshot,
  Timestamp,
} from "firebase-admin/firestore";
import { FieldPath } from "firebase-admin/firestore";
import { FIRESTORE_COLLECTIONS } from "@/server/repositories/firestore/collections";
import type { FirestoreEntityMapper } from "@/server/repositories/firestore/mappers";
import {
  activityLogMapper,
  aiIntakeDraftMapper,
  assignmentMapper,
  clientOrganizationContactLinkMapper,
  clientInvoiceMapper,
  clientQuoteMapper,
  clientOrganizationMapper,
  communicationAttachmentMapper,
  communicationLinkMapper,
  communicationMatchSuggestionMapper,
  communicationMessageMapper,
  communicationParticipantMapper,
  communicationThreadMapper,
  contactMapper,
  contractorContactLinkMapper,
  contractorQuoteMapper,
  deliveryAttemptMapper,
  deliveryPlanMapper,
  domainEventMapper,
  contractorOrganizationMapper,
  escalationOrchestrationMapper,
  eventProcessingMapper,
  internalNotificationMapper,
  intakeApprovalMapper,
  intakeArtifactMapper,
  intakeDecisionMapper,
  intakeEventMapper,
  locationContactLinkMapper,
  locationMapper,
  providerConnectionMapper,
  providerMessageReceiptMapper,
  providerSyncCheckpointMapper,
  providerSyncRunMapper,
  providerThreadMappingMapper,
  slaScanCursorMapper,
  slaTimerMapper,
  workerDeadLetterMapper,
  workerJobMapper,
  transitionAuditMapper,
  transitionEventMapper,
  userProfileMapper,
  workOrderMapper,
} from "@/server/repositories/firestore/mappers";
import type {
  ActivityLog,
  ActivityLogDocument,
  AiIntakeDraftDocument,
  Assignment,
  AssignmentDocument,
  ClientOrganizationContactLink,
  ClientOrganizationContactLinkDocument,
  ClientInvoice,
  ClientInvoiceDocument,
  ClientQuote,
  ClientQuoteDocument,
  ClientOrganization,
  ClientOrganizationDocument,
  CommunicationAttachmentDocument,
  CommunicationLinkDocument,
  CommunicationMatchSuggestionDocument,
  CommunicationMessageDocument,
  CommunicationParticipantDocument,
  CommunicationThreadDocument,
  Contact,
  ContactDocument,
  ContractorContactLink,
  ContractorContactLinkDocument,
  ContractorQuote,
  ContractorQuoteDocument,
  ContractorOrganization,
  ContractorOrganizationDocument,
  DeliveryAttemptDocument,
  DeliveryPlanDocument,
  InternalNotification,
  InternalNotificationDocument,
  IntakeApprovalDocument,
  IntakeArtifactDocument,
  IntakeDecisionDocument,
  IntakeEventDocument,
  DomainEventDocument,
  EscalationOrchestrationDocument,
  EventProcessingDocument,
  Location,
  LocationContactLink,
  LocationContactLinkDocument,
  LocationDocument,
  ProviderConnectionDocument,
  ProviderMessageReceiptDocument,
  ProviderSyncCheckpointDocument,
  ProviderSyncRunDocument,
  ProviderThreadMappingDocument,
  SlaScanCursorDocument,
  SlaTimerDocument,
  WorkerDeadLetterDocument,
  WorkerJobDocument,
  TransitionAuditDocument,
  TransitionEventDocument,
  UserProfile,
  UserProfileDocument,
  WorkOrder,
  WorkOrderDocument,
} from "@/server/repositories/firestore/models";
import type {
  DomainEvent,
  TransitionAudit,
  TransitionEvent,
} from "@/server/events/types";
import type { CommunicationLink } from "@/modules/communications";
import { getFirebaseAdminFirestore } from "@/server/firebase";
import { toFirestoreTimestamp } from "@/server/repositories/firestore/timestamps";
import type { EntityId } from "@/types/entity";
import type { InvoiceStatus } from "@/types/invoice";
import type { ClientQuoteStatus, ContractorQuoteStatus } from "@/types/quote";

export interface RepositoryListOptions {
  limit?: number;
}

export interface RepositoryListResult<T> {
  items: T[];
  count: number;
}

export interface RepositoryMutationResult<T> {
  id: EntityId;
  item: T;
}

export interface EntityRepository<TDomain> {
  newId(): EntityId;
  getById(id: EntityId): Promise<TDomain | null>;
  create(entity: TDomain): Promise<RepositoryMutationResult<TDomain>>;
  save(entity: TDomain): Promise<RepositoryMutationResult<TDomain>>;
}

export interface UserProfileRepository extends EntityRepository<UserProfile> {
  getByEmail(email: string): Promise<UserProfile | null>;
  listByOrganizationId(
    organizationId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<UserProfile>>;
  listByContractorOrganizationId(
    contractorOrganizationId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<UserProfile>>;
}

export interface ContactRepository extends EntityRepository<Contact> {
  listByOrganizationId(
    organizationId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<Contact>>;
  listByIds(contactIds: readonly EntityId[]): Promise<RepositoryListResult<Contact>>;
}

export interface ClientOrganizationRepository
  extends EntityRepository<ClientOrganization> {
  listByOrganizationId(
    organizationId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<ClientOrganization>>;
  listActive(options?: RepositoryListOptions): Promise<
    RepositoryListResult<ClientOrganization>
  >;
}

export interface ClientOrganizationContactLinkRepository
  extends EntityRepository<ClientOrganizationContactLink> {
  listByClientOrganizationId(
    clientOrganizationId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<ClientOrganizationContactLink>>;
  replaceForClientOrganizationId(
    clientOrganizationId: EntityId,
    links: readonly ClientOrganizationContactLink[],
  ): Promise<void>;
}

export interface LocationRepository extends EntityRepository<Location> {
  listByOrganizationId(
    organizationId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<Location>>;
  listByClientOrganizationId(
    clientOrganizationId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<Location>>;
}

export interface LocationContactLinkRepository
  extends EntityRepository<LocationContactLink> {
  listByLocationId(
    locationId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<LocationContactLink>>;
  replaceForLocationId(
    locationId: EntityId,
    links: readonly LocationContactLink[],
  ): Promise<void>;
}

export interface ContractorOrganizationRepository
  extends EntityRepository<ContractorOrganization> {
  listByOrganizationId(
    organizationId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<ContractorOrganization>>;
  listActive(options?: RepositoryListOptions): Promise<
    RepositoryListResult<ContractorOrganization>
  >;
}

export interface ContractorContactLinkRepository
  extends EntityRepository<ContractorContactLink> {
  listByContractorId(
    contractorId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<ContractorContactLink>>;
  replaceForContractorId(
    contractorId: EntityId,
    links: readonly ContractorContactLink[],
  ): Promise<void>;
}

export interface WorkOrderRepository extends EntityRepository<WorkOrder> {
  listByOrganizationId(
    organizationId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<WorkOrder>>;
  listByClientOrganizationId(
    clientOrganizationId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<WorkOrder>>;
  listByLocationId(
    locationId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<WorkOrder>>;
  listByCoordinatorUserId(
    coordinatorUserId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<WorkOrder>>;
  listByManagerUserId(
    managerUserId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<WorkOrder>>;
  listByContractorOrganizationId(
    contractorOrganizationId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<WorkOrder>>;
}

export interface ContractorQuoteRepository
  extends EntityRepository<ContractorQuote> {
  listByWorkOrderId(
    workOrderId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<ContractorQuote>>;
  listPendingReview(
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<ContractorQuote>>;
}

export interface ClientQuoteRepository extends EntityRepository<ClientQuote> {
  listByWorkOrderId(
    workOrderId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<ClientQuote>>;
  getActiveByWorkOrderId(workOrderId: EntityId): Promise<ClientQuote | null>;
}

export interface ClientInvoiceRepository extends EntityRepository<ClientInvoice> {
  listByWorkOrderId(
    workOrderId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<ClientInvoice>>;
  listFinanceQueue(options?: RepositoryListOptions): Promise<
    RepositoryListResult<ClientInvoice>
  >;
}

export interface AssignmentRepository extends EntityRepository<Assignment> {
  listByWorkOrderId(
    workOrderId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<Assignment>>;
  getActiveByWorkOrderId(workOrderId: EntityId): Promise<Assignment | null>;
  listByContractorOrganizationId(
    contractorOrganizationId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<Assignment>>;
}

export interface ActivityLogRepository {
  newId(): EntityId;
  getById(id: EntityId): Promise<ActivityLog | null>;
  create(entity: ActivityLog): Promise<RepositoryMutationResult<ActivityLog>>;
  listByWorkOrderId(
    workOrderId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<ActivityLog>>;
}

export interface InternalNotificationRepository
  extends EntityRepository<InternalNotification> {
  createMany(
    notifications: readonly InternalNotification[],
  ): Promise<readonly RepositoryMutationResult<InternalNotification>[]>;
  listByRecipientUserId(
    recipientUserId: EntityId,
    options?: RepositoryListOptions & {
      status?: InternalNotification["status"];
    },
  ): Promise<RepositoryListResult<InternalNotification>>;
}

export interface CommunicationThreadRepository
  extends EntityRepository<CommunicationThread> {
  listByWorkOrderId(
    workOrderId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<CommunicationThread>>;
  findByWorkOrderChannelVisibility(input: {
    workOrderId: EntityId;
    channel: CommunicationChannel;
    visibility: readonly CommunicationVisibility[];
  }): Promise<CommunicationThread | null>;
}

export interface CommunicationMessageRepository
  extends EntityRepository<CommunicationMessage> {
  listByThreadId(
    threadId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<CommunicationMessage>>;
  listByWorkOrderId(
    workOrderId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<CommunicationMessage>>;
}

export interface CommunicationParticipantRepository
  extends EntityRepository<CommunicationParticipant> {
  listByThreadId(
    threadId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<CommunicationParticipant>>;
}

export interface CommunicationLinkRepository
  extends EntityRepository<CommunicationLink> {
  listByMessageId(
    messageId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<CommunicationLink>>;
  listByWorkOrderId(
    workOrderId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<CommunicationLink>>;
}

export interface CommunicationAttachmentRepository
  extends EntityRepository<CommunicationAttachment> {
  listByMessageId(
    messageId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<CommunicationAttachment>>;
  listByWorkOrderId(
    workOrderId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<CommunicationAttachment>>;
}

export interface CommunicationMatchSuggestionRepository
  extends EntityRepository<CommunicationMatchSuggestion> {
  listByWorkOrderId(
    workOrderId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<CommunicationMatchSuggestion>>;
  listPendingReview(
    organizationId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<CommunicationMatchSuggestion>>;
}

export interface ProviderConnectionRepository extends EntityRepository<ProviderConnection> {
  listByOrganizationId(
    organizationId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<ProviderConnection>>;
  findByMailboxAddress(input: {
    organizationId: EntityId;
    providerKey: ProviderConnection["providerKey"];
    mailboxAddress: string;
  }): Promise<ProviderConnection | null>;
}

export interface ProviderSyncCheckpointRepository extends EntityRepository<ProviderSyncCheckpoint> {
  listByConnectionId(
    providerConnectionId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<ProviderSyncCheckpoint>>;
  findByScope(input: {
    organizationId: EntityId;
    providerConnectionId: EntityId | null;
    checkpointType: ProviderSyncCheckpoint["checkpointType"];
    mailboxAddress: string | null;
    folderId: string | null;
  }): Promise<ProviderSyncCheckpoint | null>;
}

export interface ProviderSyncRunRepository extends EntityRepository<ProviderSyncRun> {
  listByConnectionId(
    connectionId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<ProviderSyncRun>>;
  listByOrganizationId(
    organizationId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<ProviderSyncRun>>;
}

export interface ProviderMessageReceiptRepository extends EntityRepository<ProviderMessageReceipt> {
  findByFingerprint(
    organizationId: EntityId,
    fingerprint: string,
  ): Promise<ProviderMessageReceipt | null>;
  findByProviderMessage(input: {
    organizationId: EntityId;
    providerKey: ProviderMessageReceipt["providerKey"];
    providerConnectionId: EntityId | null;
    providerMessageId: string | null;
    internetMessageId: string | null;
  }): Promise<ProviderMessageReceipt | null>;
  listByConnectionId(
    providerConnectionId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<ProviderMessageReceipt>>;
  listByOrganizationId(
    organizationId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<ProviderMessageReceipt>>;
}

export interface ProviderThreadMappingRepository extends EntityRepository<ProviderThreadMapping> {
  findByProviderThread(input: {
    organizationId: EntityId;
    providerKey: ProviderThreadMapping["providerKey"];
    providerConnectionId: EntityId | null;
    providerThreadId: string;
  }): Promise<ProviderThreadMapping | null>;
  listByConnectionId(
    providerConnectionId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<ProviderThreadMapping>>;
}

export interface WorkerJobRepository extends EntityRepository<WorkerJob> {
  findByIdempotencyKey(input: {
    organizationId: EntityId;
    type: string;
    idempotencyKey: string;
  }): Promise<WorkerJob | null>;
  listByOrganizationId(
    organizationId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<WorkerJob>>;
  claimNext(input: {
    organizationId: EntityId;
    workerId: string;
    leaseDurationMs: number;
    now: string;
    jobTypes?: readonly string[];
  }): Promise<WorkerJob | null>;
  listByTimer(input: {
    organizationId: EntityId;
    timerId: EntityId;
    statuses?: readonly WorkerJob["status"][];
    limit?: number;
  }): Promise<RepositoryListResult<WorkerJob>>;
}

export interface WorkerDeadLetterRepository extends EntityRepository<WorkerDeadLetterRecord> {
  listByOrganizationId(
    organizationId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<WorkerDeadLetterRecord>>;
  findByOriginalJobId(originalJobId: EntityId): Promise<WorkerDeadLetterRecord | null>;
}

export interface DomainEventRepository extends EntityRepository<DomainEvent> {
  listByOrganizationId(
    organizationId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<DomainEvent>>;
  listByWorkOrderId(
    workOrderId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<DomainEvent>>;
  listByEntity(
    entity: DomainEvent["entity"],
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<DomainEvent>>;
}

export interface TransitionEventRepository extends EntityRepository<TransitionEvent> {
  listByWorkOrderId(
    workOrderId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<TransitionEvent>>;
}

export interface TransitionAuditRepository extends EntityRepository<TransitionAudit> {
  listByWorkOrderId(
    workOrderId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<TransitionAudit>>;
}

export interface IntakeEventRepository extends EntityRepository<IntakeEvent> {
  listByOrganizationId(
    organizationId: EntityId,
    options?: RepositoryListOptions & {
      status?: IntakeEvent["status"];
    },
  ): Promise<RepositoryListResult<IntakeEvent>>;
}

export interface IntakeArtifactRepository extends EntityRepository<IntakeArtifact> {
  listByIntakeEventId(
    intakeEventId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<IntakeArtifact>>;
}

export interface AiIntakeDraftRepository extends EntityRepository<AiIntakeDraft> {
  listByIntakeEventId(
    intakeEventId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<AiIntakeDraft>>;
  listPendingReview(
    organizationId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<AiIntakeDraft>>;
}

export interface IntakeApprovalRepository extends EntityRepository<IntakeApproval> {
  listByIntakeEventId(
    intakeEventId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<IntakeApproval>>;
}

export interface IntakeDecisionRepository extends EntityRepository<IntakeDecision> {
  listByIntakeEventId(
    intakeEventId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<IntakeDecision>>;
}

export interface EventProcessingRepository extends EntityRepository<EventProcessingRecord> {
  findBySubscriberEvent(input: {
    organizationId: EntityId;
    subscriberKey: string;
    sourceEventId: EntityId;
  }): Promise<EventProcessingRecord | null>;
  listByOrganizationId(
    organizationId: EntityId,
    options?: RepositoryListOptions & {
      subscriberKey?: string;
      sourceEventId?: EntityId;
      status?: EventProcessingRecord["status"];
    },
  ): Promise<RepositoryListResult<EventProcessingRecord>>;
}

export interface DeliveryPlanRepository extends EntityRepository<CanonicalDeliveryPlan> {
  findByIdempotencyKey(input: {
    organizationId: EntityId;
    deliveryType: CanonicalDeliveryPlan["deliveryType"];
    idempotencyKey: string;
  }): Promise<CanonicalDeliveryPlan | null>;
  findActiveForRecipient(input: {
    organizationId: EntityId;
    deliveryType: CanonicalDeliveryPlan["deliveryType"];
    sourceEscalationId: EntityId;
    sourceEscalationStageNumber: number | null;
    recipientId: EntityId;
    channel: CanonicalDeliveryPlan["channel"];
  }): Promise<CanonicalDeliveryPlan | null>;
  listByOrganizationId(
    organizationId: EntityId,
    options?: RepositoryListOptions & {
      statuses?: readonly CanonicalDeliveryPlan["status"][];
      channel?: CanonicalDeliveryPlan["channel"];
      deliveryType?: CanonicalDeliveryPlan["deliveryType"];
    },
  ): Promise<RepositoryListResult<CanonicalDeliveryPlan>>;
  listByEscalation(input: {
    organizationId: EntityId;
    sourceEscalationId: EntityId;
    limit?: number;
  }): Promise<RepositoryListResult<CanonicalDeliveryPlan>>;
}

export interface DeliveryAttemptRepository extends EntityRepository<DeliveryAttempt> {
  findByIdempotencyKey(input: {
    organizationId: EntityId;
    deliveryPlanId: EntityId;
    idempotencyKey: string;
  }): Promise<DeliveryAttempt | null>;
  listByDeliveryPlanId(input: {
    organizationId: EntityId;
    deliveryPlanId: EntityId;
    limit?: number;
  }): Promise<RepositoryListResult<DeliveryAttempt>>;
  listByOrganizationId(
    organizationId: EntityId,
    options?: RepositoryListOptions & {
      statuses?: readonly DeliveryAttempt["status"][];
      channel?: DeliveryAttempt["channel"];
      adapterType?: DeliveryAttempt["adapterType"];
    },
  ): Promise<RepositoryListResult<DeliveryAttempt>>;
}

export interface EscalationOrchestrationRepository extends EntityRepository<EscalationOrchestration> {
  findByIdempotencyKey(input: {
    organizationId: EntityId;
    escalationType: EscalationOrchestration["escalationType"];
    idempotencyKey: string;
  }): Promise<EscalationOrchestration | null>;
  findLatestByTimer(input: {
    organizationId: EntityId;
    escalationType: EscalationOrchestration["escalationType"];
    sourceSlaTimerId: EntityId;
  }): Promise<EscalationOrchestration | null>;
  findOpenByCondition(input: {
    organizationId: EntityId;
    escalationType: EscalationOrchestration["escalationType"];
    targetEntityType: EscalationOrchestration["targetEntityType"];
    targetEntityId: EntityId;
  }): Promise<EscalationOrchestration | null>;
  listByOrganizationId(
    organizationId: EntityId,
    options?: RepositoryListOptions & {
      statuses?: readonly EscalationOrchestration["status"][];
      escalationType?: EscalationOrchestration["escalationType"];
    },
  ): Promise<RepositoryListResult<EscalationOrchestration>>;
}

export interface SlaTimerRepository extends EntityRepository<SlaTimer> {
  findByIdempotencyKey(input: {
    organizationId: EntityId;
    type: SlaTimer["type"];
    idempotencyKey: string;
  }): Promise<SlaTimer | null>;
  listByOrganizationId(
    organizationId: EntityId,
    options?: RepositoryListOptions & {
      statuses?: readonly SlaTimer["status"][];
      type?: SlaTimer["type"];
    },
  ): Promise<RepositoryListResult<SlaTimer>>;
  scanScheduledDueTimers(input: {
    organizationId: EntityId;
    dueBefore: string;
    limit: number;
    type?: SlaTimer["type"];
    after?: {
      dueAt: string;
      id: EntityId;
    } | null;
  }): Promise<RepositoryListResult<SlaTimer>>;
}

export interface SlaScanCursorRepository extends EntityRepository<SlaScanCursor> {
  findByScanType(input: {
    organizationId: EntityId;
    scanType: SlaScanCursor["scanType"];
    timerType?: string | null;
  }): Promise<SlaScanCursor | null>;
  listByOrganizationId(
    organizationId: EntityId,
    options?: RepositoryListOptions & {
      scanType?: SlaScanCursor["scanType"];
    },
  ): Promise<RepositoryListResult<SlaScanCursor>>;
}

export interface FirestoreRepositories {
  userProfiles: UserProfileRepository;
  contacts: ContactRepository;
  clientOrganizations: ClientOrganizationRepository;
  clientOrganizationContactLinks: ClientOrganizationContactLinkRepository;
  locations: LocationRepository;
  locationContactLinks: LocationContactLinkRepository;
  contractorOrganizations: ContractorOrganizationRepository;
  contractorContactLinks: ContractorContactLinkRepository;
  workOrders: WorkOrderRepository;
  contractorQuotes: ContractorQuoteRepository;
  clientQuotes: ClientQuoteRepository;
  clientInvoices: ClientInvoiceRepository;
  assignments: AssignmentRepository;
  activityLogs: ActivityLogRepository;
  domainEvents: DomainEventRepository;
  transitionEvents: TransitionEventRepository;
  transitionAudits: TransitionAuditRepository;
  intakeEvents: IntakeEventRepository;
  intakeArtifacts: IntakeArtifactRepository;
  aiIntakeDrafts: AiIntakeDraftRepository;
  intakeApprovals: IntakeApprovalRepository;
  intakeDecisions: IntakeDecisionRepository;
  communicationThreads: CommunicationThreadRepository;
  communicationMessages: CommunicationMessageRepository;
  communicationParticipants: CommunicationParticipantRepository;
  communicationLinks: CommunicationLinkRepository;
  communicationAttachments: CommunicationAttachmentRepository;
  communicationMatchSuggestions: CommunicationMatchSuggestionRepository;
  providerConnections: ProviderConnectionRepository;
  providerSyncCheckpoints: ProviderSyncCheckpointRepository;
  providerSyncRuns: ProviderSyncRunRepository;
  providerMessageReceipts: ProviderMessageReceiptRepository;
  providerThreadMappings: ProviderThreadMappingRepository;
  runtimeJobs: WorkerJobRepository;
  runtimeDeadLetters: WorkerDeadLetterRepository;
  runtimeEventProcessings: EventProcessingRepository;
  deliveryPlans: DeliveryPlanRepository;
  deliveryAttempts: DeliveryAttemptRepository;
  escalationOrchestrations: EscalationOrchestrationRepository;
  slaTimers: SlaTimerRepository;
  slaScanCursors: SlaScanCursorRepository;
  internalNotifications: InternalNotificationRepository;
}

class BaseFirestoreRepository<TDomain extends { id: EntityId }, TDocument>
  implements EntityRepository<TDomain>
{
  protected readonly collection: CollectionReference<DocumentData>;

  constructor(
    protected readonly firestore: Firestore,
    collectionName: string,
    protected readonly mapper: FirestoreEntityMapper<TDomain, TDocument>,
  ) {
    this.collection = firestore.collection(collectionName);
  }

  newId(): EntityId {
    return this.collection.doc().id;
  }

  async getById(id: EntityId): Promise<TDomain | null> {
    const normalizedId = id.trim();
    if (!normalizedId) {
      return null;
    }

    const snapshot = await this.collection.doc(normalizedId).get();
    if (!snapshot.exists) {
      return null;
    }

    return this.mapper.toDomain(
      snapshot.id,
      snapshot.data() as TDocument,
    );
  }

  async create(entity: TDomain): Promise<RepositoryMutationResult<TDomain>> {
    const ref = this.collection.doc(entity.id);
    await ref.create(this.mapper.toDocument(entity) as DocumentData);
    return { id: entity.id, item: entity };
  }

  async save(entity: TDomain): Promise<RepositoryMutationResult<TDomain>> {
    const ref = this.collection.doc(entity.id);
    await ref.set(this.mapper.toDocument(entity) as DocumentData, { merge: true });
    return { id: entity.id, item: entity };
  }

  protected async listFromQuery(
    query: Query<DocumentData>,
  ): Promise<RepositoryListResult<TDomain>> {
    const snapshot = await query.get();
    const items = snapshot.docs.map((document) =>
      this.fromSnapshot(document),
    );

    return { items, count: items.length };
  }

  protected fromSnapshot(
    snapshot: QueryDocumentSnapshot<DocumentData>,
  ): TDomain {
    return this.mapper.toDomain(snapshot.id, snapshot.data() as TDocument);
  }

  protected withLimit(
    query: Query<DocumentData>,
    options: RepositoryListOptions = {},
  ): Query<DocumentData> {
    return options.limit ? query.limit(options.limit) : query;
  }
}

class FirestoreUserProfileRepository
  extends BaseFirestoreRepository<UserProfile, UserProfileDocument>
  implements UserProfileRepository
{
  async getByEmail(email: string): Promise<UserProfile | null> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      return null;
    }

    const result = await this.listFromQuery(
      this.collection.where("email", "==", normalizedEmail).limit(1),
    );
    return result.items[0] ?? null;
  }

  listByOrganizationId(
    organizationId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<UserProfile>> {
    const query = this.collection
      .where("organizationId", "==", organizationId)
      .where("isDeleted", "==", false)
      .orderBy("email", "asc");
    return this.listFromQuery(this.withLimit(query, options));
  }

  listByContractorOrganizationId(
    contractorOrganizationId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<UserProfile>> {
    const query = this.collection
      .where("contractorOrganizationId", "==", contractorOrganizationId)
      .where("isDeleted", "==", false)
      .orderBy("email", "asc");
    return this.listFromQuery(this.withLimit(query, options));
  }
}

class FirestoreContactRepository
  extends BaseFirestoreRepository<Contact, ContactDocument>
  implements ContactRepository
{
  listByOrganizationId(
    organizationId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<Contact>> {
    const query = this.collection
      .where("organizationId", "==", organizationId)
      .where("isDeleted", "==", false)
      .orderBy("displayName", "asc");
    return this.listFromQuery(this.withLimit(query, options));
  }

  async listByIds(contactIds: readonly EntityId[]): Promise<RepositoryListResult<Contact>> {
    const normalizedIds = [...new Set(contactIds.map((id) => id.trim()).filter(Boolean))];
    if (normalizedIds.length === 0) {
      return { items: [], count: 0 };
    }

    const items = (
      await Promise.all(normalizedIds.map((contactId) => this.getById(contactId)))
    ).filter((contact): contact is Contact => Boolean(contact && !contact.isDeleted));

    return { items, count: items.length };
  }
}

class FirestoreClientOrganizationRepository
  extends BaseFirestoreRepository<
    ClientOrganization,
    ClientOrganizationDocument
  >
  implements ClientOrganizationRepository
{
  listByOrganizationId(
    organizationId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<ClientOrganization>> {
    const query = this.collection
      .where("organizationId", "==", organizationId)
      .where("isDeleted", "==", false)
      .orderBy("name", "asc");
    return this.listFromQuery(this.withLimit(query, options));
  }

  listActive(
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<ClientOrganization>> {
    const query = this.collection
      .where("status", "==", "active")
      .where("isDeleted", "==", false)
      .orderBy("name", "asc");
    return this.listFromQuery(this.withLimit(query, options));
  }
}

class FirestoreClientOrganizationContactLinkRepository
  extends BaseFirestoreRepository<
    ClientOrganizationContactLink,
    ClientOrganizationContactLinkDocument
  >
  implements ClientOrganizationContactLinkRepository
{
  listByClientOrganizationId(
    clientOrganizationId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<ClientOrganizationContactLink>> {
    const query = this.collection
      .where("clientOrganizationId", "==", clientOrganizationId)
      .where("isDeleted", "==", false)
      .orderBy("createdAt", "asc");
    return this.listFromQuery(this.withLimit(query, options));
  }

  async replaceForClientOrganizationId(
    clientOrganizationId: EntityId,
    links: readonly ClientOrganizationContactLink[],
  ): Promise<void> {
    const existing = await this.listByClientOrganizationId(clientOrganizationId, {
      limit: 100,
    });
    const keepIds = new Set(links.map((link) => link.id));

    await Promise.all([
      ...existing.items
        .filter((link) => !keepIds.has(link.id))
        .map((link) => this.collection.doc(link.id).delete()),
      ...links.map((link) =>
        this.collection
          .doc(link.id)
          .set(this.mapper.toDocument(link) as DocumentData, { merge: true }),
      ),
    ]);
  }
}

class FirestoreLocationRepository
  extends BaseFirestoreRepository<Location, LocationDocument>
  implements LocationRepository
{
  listByOrganizationId(
    organizationId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<Location>> {
    const query = this.collection
      .where("organizationId", "==", organizationId)
      .where("isDeleted", "==", false)
      .orderBy("name", "asc");
    return this.listFromQuery(this.withLimit(query, options));
  }

  listByClientOrganizationId(
    clientOrganizationId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<Location>> {
    const query = this.collection
      .where("clientOrganizationId", "==", clientOrganizationId)
      .where("isDeleted", "==", false)
      .orderBy("name", "asc");
    return this.listFromQuery(this.withLimit(query, options));
  }
}

class FirestoreLocationContactLinkRepository
  extends BaseFirestoreRepository<LocationContactLink, LocationContactLinkDocument>
  implements LocationContactLinkRepository
{
  listByLocationId(
    locationId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<LocationContactLink>> {
    const query = this.collection
      .where("locationId", "==", locationId)
      .where("isDeleted", "==", false)
      .orderBy("createdAt", "asc");
    return this.listFromQuery(this.withLimit(query, options));
  }

  async replaceForLocationId(
    locationId: EntityId,
    links: readonly LocationContactLink[],
  ): Promise<void> {
    const existing = await this.listByLocationId(locationId, { limit: 100 });
    const keepIds = new Set(links.map((link) => link.id));

    await Promise.all([
      ...existing.items
        .filter((link) => !keepIds.has(link.id))
        .map((link) => this.collection.doc(link.id).delete()),
      ...links.map((link) =>
        this.collection
          .doc(link.id)
          .set(this.mapper.toDocument(link) as DocumentData, { merge: true }),
      ),
    ]);
  }
}

class FirestoreContractorOrganizationRepository
  extends BaseFirestoreRepository<
    ContractorOrganization,
    ContractorOrganizationDocument
  >
  implements ContractorOrganizationRepository
{
  listByOrganizationId(
    organizationId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<ContractorOrganization>> {
    const query = this.collection
      .where("organizationId", "==", organizationId)
      .where("isDeleted", "==", false)
      .orderBy("name", "asc");
    return this.listFromQuery(this.withLimit(query, options));
  }

  listActive(
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<ContractorOrganization>> {
    const query = this.collection
      .where("status", "==", "active")
      .where("isDeleted", "==", false)
      .orderBy("name", "asc");
    return this.listFromQuery(this.withLimit(query, options));
  }
}

class FirestoreContractorContactLinkRepository
  extends BaseFirestoreRepository<
    ContractorContactLink,
    ContractorContactLinkDocument
  >
  implements ContractorContactLinkRepository
{
  listByContractorId(
    contractorId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<ContractorContactLink>> {
    const query = this.collection
      .where("contractorId", "==", contractorId)
      .where("isDeleted", "==", false)
      .orderBy("createdAt", "asc");
    return this.listFromQuery(this.withLimit(query, options));
  }

  async replaceForContractorId(
    contractorId: EntityId,
    links: readonly ContractorContactLink[],
  ): Promise<void> {
    const existing = await this.listByContractorId(contractorId, { limit: 100 });
    const keepIds = new Set(links.map((link) => link.id));

    await Promise.all([
      ...existing.items
        .filter((link) => !keepIds.has(link.id))
        .map((link) => this.collection.doc(link.id).delete()),
      ...links.map((link) =>
        this.collection
          .doc(link.id)
          .set(this.mapper.toDocument(link) as DocumentData, { merge: true }),
      ),
    ]);
  }
}

class FirestoreWorkOrderRepository
  extends BaseFirestoreRepository<WorkOrder, WorkOrderDocument>
  implements WorkOrderRepository
{
  listByOrganizationId(
    organizationId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<WorkOrder>> {
    return this.listWorkOrdersByField("organizationId", organizationId, options);
  }

  listByClientOrganizationId(
    clientOrganizationId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<WorkOrder>> {
    return this.listWorkOrdersByField(
      "clientOrganizationId",
      clientOrganizationId,
      options,
    );
  }

  listByLocationId(
    locationId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<WorkOrder>> {
    return this.listWorkOrdersByField("locationId", locationId, options);
  }

  listByCoordinatorUserId(
    coordinatorUserId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<WorkOrder>> {
    return this.listWorkOrdersByField(
      "coordinatorUserId",
      coordinatorUserId,
      options,
    );
  }

  listByManagerUserId(
    managerUserId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<WorkOrder>> {
    return this.listWorkOrdersByField(
      "managerUserId",
      managerUserId,
      options,
    );
  }

  listByContractorOrganizationId(
    contractorOrganizationId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<WorkOrder>> {
    return this.listWorkOrdersByField(
      "assignedContractorOrgId",
      contractorOrganizationId,
      options,
    );
  }

  private listWorkOrdersByField(
    fieldName: keyof WorkOrderDocument,
    fieldValue: EntityId,
    options: RepositoryListOptions,
  ): Promise<RepositoryListResult<WorkOrder>> {
    const query = this.collection
      .where(fieldName, "==", fieldValue)
      .where("isDeleted", "==", false)
      .orderBy("updatedAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }
}

class FirestoreContractorQuoteRepository
  extends BaseFirestoreRepository<ContractorQuote, ContractorQuoteDocument>
  implements ContractorQuoteRepository
{
  listByWorkOrderId(
    workOrderId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<ContractorQuote>> {
    const query = this.collection
      .where("workOrderId", "==", workOrderId)
      .where("isDeleted", "==", false)
      .orderBy("createdAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }

  listPendingReview(
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<ContractorQuote>> {
    const pendingStatuses = [
      "submitted",
      "under_review",
    ] as const satisfies readonly ContractorQuoteStatus[];
    const query = this.collection
      .where("status", "in", pendingStatuses)
      .where("isDeleted", "==", false)
      .orderBy("updatedAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }
}

class FirestoreClientQuoteRepository
  extends BaseFirestoreRepository<ClientQuote, ClientQuoteDocument>
  implements ClientQuoteRepository
{
  listByWorkOrderId(
    workOrderId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<ClientQuote>> {
    const query = this.collection
      .where("workOrderId", "==", workOrderId)
      .where("isDeleted", "==", false)
      .orderBy("createdAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }

  async getActiveByWorkOrderId(workOrderId: EntityId): Promise<ClientQuote | null> {
    const activeStatuses = [
      "draft",
      "sent",
    ] as const satisfies readonly ClientQuoteStatus[];
    const query = this.collection
      .where("workOrderId", "==", workOrderId)
      .where("status", "in", activeStatuses)
      .where("isDeleted", "==", false)
      .orderBy("updatedAt", "desc")
      .limit(1);
    const result = await this.listFromQuery(query);
    return result.items[0] ?? null;
  }
}

class FirestoreClientInvoiceRepository
  extends BaseFirestoreRepository<ClientInvoice, ClientInvoiceDocument>
  implements ClientInvoiceRepository
{
  listByWorkOrderId(
    workOrderId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<ClientInvoice>> {
    const query = this.collection
      .where("workOrderId", "==", workOrderId)
      .where("isDeleted", "==", false)
      .orderBy("updatedAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }

  listFinanceQueue(
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<ClientInvoice>> {
    const financeStatuses = [
      "draft",
      "sent",
      "viewed",
      "overdue",
      "paid",
    ] as const satisfies readonly InvoiceStatus[];
    const query = this.collection
      .where("status", "in", financeStatuses)
      .where("isDeleted", "==", false)
      .orderBy("dueDate", "asc");
    return this.listFromQuery(this.withLimit(query, options));
  }
}

class FirestoreAssignmentRepository
  extends BaseFirestoreRepository<Assignment, AssignmentDocument>
  implements AssignmentRepository
{
  listByWorkOrderId(
    workOrderId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<Assignment>> {
    const query = this.collection
      .where("workOrderId", "==", workOrderId)
      .where("isDeleted", "==", false)
      .orderBy("assignedAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }

  async getActiveByWorkOrderId(workOrderId: EntityId): Promise<Assignment | null> {
    const activeStatuses = [
      "assigned",
      "accepted",
    ] as const satisfies readonly Assignment["status"][];
    const query = this.collection
      .where("workOrderId", "==", workOrderId)
      .where("status", "in", activeStatuses)
      .where("isDeleted", "==", false)
      .orderBy("assignedAt", "desc")
      .limit(1);
    const result = await this.listFromQuery(query);
    return result.items[0] ?? null;
  }

  listByContractorOrganizationId(
    contractorOrganizationId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<Assignment>> {
    const query = this.collection
      .where("contractorOrganizationId", "==", contractorOrganizationId)
      .where("isDeleted", "==", false)
      .orderBy("assignedAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }
}

class FirestoreActivityLogRepository
  extends BaseFirestoreRepository<ActivityLog, ActivityLogDocument>
  implements ActivityLogRepository
{
  listByWorkOrderId(
    workOrderId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<ActivityLog>> {
    const query = this.collection
      .where("workOrderId", "==", workOrderId)
      .orderBy("occurredAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }
}

class FirestoreInternalNotificationRepository
  extends BaseFirestoreRepository<
    InternalNotification,
    InternalNotificationDocument
  >
  implements InternalNotificationRepository
{
  async createMany(
    notifications: readonly InternalNotification[],
  ): Promise<readonly RepositoryMutationResult<InternalNotification>[]> {
    await Promise.all(notifications.map((notification) => this.create(notification)));
    return notifications.map((notification) => ({
      id: notification.id,
      item: notification,
    }));
  }

  listByRecipientUserId(
    recipientUserId: EntityId,
    options: RepositoryListOptions & {
      status?: InternalNotification["status"];
    } = {},
  ): Promise<RepositoryListResult<InternalNotification>> {
    let query: Query<DocumentData> = this.collection
      .where("recipientUserId", "==", recipientUserId)
      .where("isDeleted", "==", false);

    if (options.status) {
      query = query.where("status", "==", options.status);
    }

    query = query.orderBy("createdAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }
}

class FirestoreCommunicationThreadRepository
  extends BaseFirestoreRepository<CommunicationThread, CommunicationThreadDocument>
  implements CommunicationThreadRepository
{
  listByWorkOrderId(
    workOrderId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<CommunicationThread>> {
    const query = this.collection
      .where("workOrderId", "==", workOrderId)
      .where("isDeleted", "==", false)
      .orderBy("updatedAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }

  async findByWorkOrderChannelVisibility(input: {
    workOrderId: EntityId;
    channel: CommunicationChannel;
    visibility: readonly CommunicationVisibility[];
  }): Promise<CommunicationThread | null> {
    const result = await this.listFromQuery(
      this.collection
        .where("workOrderId", "==", input.workOrderId)
        .where("channel", "==", input.channel)
        .where("isDeleted", "==", false)
        .orderBy("updatedAt", "desc")
        .limit(25),
    );
    const targetKey = [...input.visibility].sort().join("|");
    return (
      result.items.find((thread) => thread.visibility.slice().sort().join("|") === targetKey) ??
      null
    );
  }
}

class FirestoreCommunicationMessageRepository
  extends BaseFirestoreRepository<CommunicationMessage, CommunicationMessageDocument>
  implements CommunicationMessageRepository
{
  listByThreadId(
    threadId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<CommunicationMessage>> {
    const query = this.collection
      .where("threadId", "==", threadId)
      .where("isDeleted", "==", false)
      .orderBy("createdAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }

  listByWorkOrderId(
    workOrderId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<CommunicationMessage>> {
    const query = this.collection
      .where("workOrderId", "==", workOrderId)
      .where("isDeleted", "==", false)
      .orderBy("createdAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }
}

class FirestoreCommunicationParticipantRepository
  extends BaseFirestoreRepository<
    CommunicationParticipant,
    CommunicationParticipantDocument
  >
  implements CommunicationParticipantRepository
{
  listByThreadId(
    threadId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<CommunicationParticipant>> {
    const query = this.collection
      .where("threadId", "==", threadId)
      .where("isDeleted", "==", false)
      .orderBy("joinedAt", "asc");
    return this.listFromQuery(this.withLimit(query, options));
  }
}

class FirestoreCommunicationLinkRepository
  extends BaseFirestoreRepository<CommunicationLink, CommunicationLinkDocument>
  implements CommunicationLinkRepository
{
  listByMessageId(
    messageId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<CommunicationLink>> {
    const query = this.collection
      .where("messageId", "==", messageId)
      .where("isDeleted", "==", false)
      .orderBy("createdAt", "asc");
    return this.listFromQuery(this.withLimit(query, options));
  }

  listByWorkOrderId(
    workOrderId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<CommunicationLink>> {
    const query = this.collection
      .where("workOrderId", "==", workOrderId)
      .where("isDeleted", "==", false)
      .orderBy("createdAt", "asc");
    return this.listFromQuery(this.withLimit(query, options));
  }
}

class FirestoreCommunicationAttachmentRepository
  extends BaseFirestoreRepository<
    CommunicationAttachment,
    CommunicationAttachmentDocument
  >
  implements CommunicationAttachmentRepository
{
  listByMessageId(
    messageId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<CommunicationAttachment>> {
    const query = this.collection
      .where("messageId", "==", messageId)
      .where("isDeleted", "==", false)
      .orderBy("createdAt", "asc");
    return this.listFromQuery(this.withLimit(query, options));
  }

  listByWorkOrderId(
    workOrderId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<CommunicationAttachment>> {
    const query = this.collection
      .where("workOrderId", "==", workOrderId)
      .where("isDeleted", "==", false)
      .orderBy("createdAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }
}

class FirestoreCommunicationMatchSuggestionRepository
  extends BaseFirestoreRepository<
    CommunicationMatchSuggestion,
    CommunicationMatchSuggestionDocument
  >
  implements CommunicationMatchSuggestionRepository
{
  listByWorkOrderId(
    workOrderId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<CommunicationMatchSuggestion>> {
    const query = this.collection
      .where("workOrderId", "==", workOrderId)
      .where("isDeleted", "==", false)
      .orderBy("suggestedAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }

  listPendingReview(
    organizationId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<CommunicationMatchSuggestion>> {
    const query = this.collection
      .where("organizationId", "==", organizationId)
      .where("status", "==", "pending_review")
      .where("isDeleted", "==", false)
      .orderBy("suggestedAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }
}

class FirestoreProviderConnectionRepository
  extends BaseFirestoreRepository<ProviderConnection, ProviderConnectionDocument>
  implements ProviderConnectionRepository
{
  listByOrganizationId(
    organizationId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<ProviderConnection>> {
    const query = this.collection
      .where("organizationId", "==", organizationId)
      .where("isDeleted", "==", false)
      .orderBy("createdAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }

  async findByMailboxAddress(input: {
    organizationId: EntityId;
    providerKey: ProviderConnection["providerKey"];
    mailboxAddress: string;
  }): Promise<ProviderConnection | null> {
    const normalizedMailboxAddress = input.mailboxAddress.trim().toLowerCase();
    if (!normalizedMailboxAddress) {
      return null;
    }

    const result = await this.listFromQuery(
      this.collection
        .where("organizationId", "==", input.organizationId)
        .where("providerKey", "==", input.providerKey)
        .where("isDeleted", "==", false)
        .orderBy("createdAt", "desc")
        .limit(50),
    );

    return result.items.find((item) =>
      item.mailboxAddress?.trim().toLowerCase() === normalizedMailboxAddress
    ) ?? null;
  }
}

class FirestoreProviderSyncCheckpointRepository
  extends BaseFirestoreRepository<ProviderSyncCheckpoint, ProviderSyncCheckpointDocument>
  implements ProviderSyncCheckpointRepository
{
  listByConnectionId(
    providerConnectionId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<ProviderSyncCheckpoint>> {
    const query = this.collection
      .where("providerConnectionId", "==", providerConnectionId)
      .where("isDeleted", "==", false)
      .orderBy("updatedAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }

  async findByScope(input: {
    organizationId: EntityId;
    providerConnectionId: EntityId | null;
    checkpointType: ProviderSyncCheckpoint["checkpointType"];
    mailboxAddress: string | null;
    folderId: string | null;
  }): Promise<ProviderSyncCheckpoint | null> {
    const result = await this.listFromQuery(
      this.collection
        .where("organizationId", "==", input.organizationId)
        .where("checkpointType", "==", input.checkpointType)
        .where("isDeleted", "==", false)
        .orderBy("updatedAt", "desc")
        .limit(100),
    );

    return result.items.find((item) =>
      item.providerConnectionId === input.providerConnectionId &&
      item.mailboxScope.mailboxAddress === input.mailboxAddress &&
      item.mailboxScope.folderId === input.folderId
    ) ?? null;
  }
}

class FirestoreProviderSyncRunRepository
  extends BaseFirestoreRepository<ProviderSyncRun, ProviderSyncRunDocument>
  implements ProviderSyncRunRepository
{
  listByConnectionId(
    connectionId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<ProviderSyncRun>> {
    const query = this.collection
      .where("connectionId", "==", connectionId)
      .where("isDeleted", "==", false)
      .orderBy("startedAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }

  listByOrganizationId(
    organizationId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<ProviderSyncRun>> {
    const query = this.collection
      .where("organizationId", "==", organizationId)
      .where("isDeleted", "==", false)
      .orderBy("startedAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }
}

class FirestoreProviderMessageReceiptRepository
  extends BaseFirestoreRepository<ProviderMessageReceipt, ProviderMessageReceiptDocument>
  implements ProviderMessageReceiptRepository
{
  async findByFingerprint(
    organizationId: EntityId,
    fingerprint: string,
  ): Promise<ProviderMessageReceipt | null> {
    const result = await this.listFromQuery(
      this.collection
        .where("organizationId", "==", organizationId)
        .where("fingerprint", "==", fingerprint)
        .where("isDeleted", "==", false)
        .limit(1),
    );
    return result.items[0] ?? null;
  }

  async findByProviderMessage(input: {
    organizationId: EntityId;
    providerKey: ProviderMessageReceipt["providerKey"];
    providerConnectionId: EntityId | null;
    providerMessageId: string | null;
    internetMessageId: string | null;
  }): Promise<ProviderMessageReceipt | null> {
    const result = await this.listFromQuery(
      this.collection
        .where("organizationId", "==", input.organizationId)
        .where("providerKey", "==", input.providerKey)
        .where("isDeleted", "==", false)
        .orderBy("createdAt", "desc")
        .limit(50),
    );

    return result.items.find((item) =>
      item.providerConnectionId === input.providerConnectionId &&
      (
        (input.providerMessageId && item.providerMessageId === input.providerMessageId) ||
        (input.internetMessageId && item.internetMessageId === input.internetMessageId)
      )
    ) ?? null;
  }

  listByConnectionId(
    providerConnectionId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<ProviderMessageReceipt>> {
    const query = this.collection
      .where("providerConnectionId", "==", providerConnectionId)
      .where("isDeleted", "==", false)
      .orderBy("createdAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }

  listByOrganizationId(
    organizationId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<ProviderMessageReceipt>> {
    const query = this.collection
      .where("organizationId", "==", organizationId)
      .where("isDeleted", "==", false)
      .orderBy("createdAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }
}

class FirestoreProviderThreadMappingRepository
  extends BaseFirestoreRepository<ProviderThreadMapping, ProviderThreadMappingDocument>
  implements ProviderThreadMappingRepository
{
  async findByProviderThread(input: {
    organizationId: EntityId;
    providerKey: ProviderThreadMapping["providerKey"];
    providerConnectionId: EntityId | null;
    providerThreadId: string;
  }): Promise<ProviderThreadMapping | null> {
    const result = await this.listFromQuery(
      this.collection
        .where("organizationId", "==", input.organizationId)
        .where("providerKey", "==", input.providerKey)
        .where("providerThreadId", "==", input.providerThreadId)
        .where("isDeleted", "==", false)
        .limit(25),
    );

    return (
      result.items.find((item) => item.providerConnectionId === input.providerConnectionId) ??
      null
    );
  }

  listByConnectionId(
    providerConnectionId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<ProviderThreadMapping>> {
    const query = this.collection
      .where("providerConnectionId", "==", providerConnectionId)
      .where("isDeleted", "==", false)
      .orderBy("updatedAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }
}

class FirestoreWorkerJobRepository
  extends BaseFirestoreRepository<WorkerJob, WorkerJobDocument>
  implements WorkerJobRepository
{
  async findByIdempotencyKey(input: {
    organizationId: EntityId;
    type: string;
    idempotencyKey: string;
  }): Promise<WorkerJob | null> {
    const result = await this.listFromQuery(
      this.collection
        .where("organizationId", "==", input.organizationId)
        .where("type", "==", input.type)
        .where("idempotencyKey", "==", input.idempotencyKey)
        .limit(1),
    );
    return result.items[0] ?? null;
  }

  listByOrganizationId(
    organizationId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<WorkerJob>> {
    const query = this.collection
      .where("organizationId", "==", organizationId)
      .where("isDeleted", "==", false)
      .orderBy("createdAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }

  async listByTimer(input: {
    organizationId: EntityId;
    timerId: EntityId;
    statuses?: readonly WorkerJob["status"][];
    limit?: number;
  }): Promise<RepositoryListResult<WorkerJob>> {
    const query = this.collection
      .where("organizationId", "==", input.organizationId)
      .where("type", "==", "sla.timer.evaluate")
      .where("payload.timerId", "==", input.timerId)
      .where("isDeleted", "==", false)
      .orderBy("createdAt", "desc");
    const result = await this.listFromQuery(this.withLimit(query, { limit: input.limit ?? 25 }));
    return {
      ...result,
      items: result.items.filter((item) =>
        input.statuses?.length ? input.statuses.includes(item.status) : true,
      ),
    };
  }

  async claimNext(input: {
    organizationId: EntityId;
    workerId: string;
    leaseDurationMs: number;
    now: string;
    jobTypes?: readonly string[];
  }): Promise<WorkerJob | null> {
    const claimedQueued = await this.tryClaimQueuedJob(input);
    if (claimedQueued) {
      return claimedQueued;
    }

    return this.tryClaimExpiredLease(input);
  }

  private async tryClaimQueuedJob(input: {
    organizationId: EntityId;
    workerId: string;
    leaseDurationMs: number;
    now: string;
    jobTypes?: readonly string[];
  }): Promise<WorkerJob | null> {
    const nowTimestamp = toFirestoreTimestamp(input.now);
    const baseQuery = this.collection
      .where("organizationId", "==", input.organizationId)
      .where("status", "==", "queued")
      .where("runAfter", "<=", nowTimestamp)
      .orderBy("runAfter", "asc")
      .limit(10);

    return this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(baseQuery);
      for (const document of snapshot.docs) {
        const candidate = this.fromSnapshot(document);
        if (input.jobTypes?.length && !input.jobTypes.includes(candidate.type)) {
          continue;
        }

        const claimed = this.toClaimedJob(candidate, input.workerId, input.now, input.leaseDurationMs);
        transaction.set(document.ref, this.mapper.toDocument(claimed) as DocumentData, { merge: true });
        return claimed;
      }
      return null;
    });
  }

  private async tryClaimExpiredLease(input: {
    organizationId: EntityId;
    workerId: string;
    leaseDurationMs: number;
    now: string;
    jobTypes?: readonly string[];
  }): Promise<WorkerJob | null> {
    const nowTimestamp = toFirestoreTimestamp(input.now);
    const baseQuery = this.collection
      .where("organizationId", "==", input.organizationId)
      .where("status", "in", ["leased", "running"])
      .where("leaseExpiresAt", "<=", nowTimestamp)
      .orderBy("leaseExpiresAt", "asc")
      .limit(10);

    return this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(baseQuery);
      for (const document of snapshot.docs) {
        const candidate = this.fromSnapshot(document);
        if (input.jobTypes?.length && !input.jobTypes.includes(candidate.type)) {
          continue;
        }

        const claimed = this.toClaimedJob(candidate, input.workerId, input.now, input.leaseDurationMs);
        transaction.set(document.ref, this.mapper.toDocument(claimed) as DocumentData, { merge: true });
        return claimed;
      }
      return null;
    });
  }

  private toClaimedJob(
    job: WorkerJob,
    workerId: string,
    now: string,
    leaseDurationMs: number,
  ): WorkerJob {
    return {
      ...job,
      status: "leased",
      leasedBy: workerId,
      leaseExpiresAt: new Date(Date.parse(now) + leaseDurationMs).toISOString(),
      updatedAt: now,
      attemptCount: job.attemptCount + 1,
    };
  }
}

class FirestoreWorkerDeadLetterRepository
  extends BaseFirestoreRepository<WorkerDeadLetterRecord, WorkerDeadLetterDocument>
  implements WorkerDeadLetterRepository
{
  listByOrganizationId(
    organizationId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<WorkerDeadLetterRecord>> {
    const query = this.collection
      .where("organizationId", "==", organizationId)
      .where("isDeleted", "==", false)
      .orderBy("createdAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }

  async findByOriginalJobId(originalJobId: EntityId): Promise<WorkerDeadLetterRecord | null> {
    const result = await this.listFromQuery(
      this.collection.where("originalJobId", "==", originalJobId).limit(1),
    );
    return result.items[0] ?? null;
  }
}

class FirestoreEventProcessingRepository
  extends BaseFirestoreRepository<EventProcessingRecord, EventProcessingDocument>
  implements EventProcessingRepository
{
  async findBySubscriberEvent(input: {
    organizationId: EntityId;
    subscriberKey: string;
    sourceEventId: EntityId;
  }): Promise<EventProcessingRecord | null> {
    const result = await this.listFromQuery(
      this.collection
        .where("organizationId", "==", input.organizationId)
        .where("subscriberKey", "==", input.subscriberKey)
        .where("sourceEventId", "==", input.sourceEventId)
        .where("isDeleted", "==", false)
        .limit(1),
    );
    return result.items[0] ?? null;
  }

  async listByOrganizationId(
    organizationId: EntityId,
    options: RepositoryListOptions & {
      subscriberKey?: string;
      sourceEventId?: EntityId;
      status?: EventProcessingRecord["status"];
    } = {},
  ): Promise<RepositoryListResult<EventProcessingRecord>> {
    let query: Query<DocumentData> = this.collection
      .where("organizationId", "==", organizationId)
      .where("isDeleted", "==", false);

    if (options.subscriberKey) {
      query = query.where("subscriberKey", "==", options.subscriberKey);
    }
    if (options.sourceEventId) {
      query = query.where("sourceEventId", "==", options.sourceEventId);
    }
    if (options.status) {
      query = query.where("status", "==", options.status);
    }

    return this.listFromQuery(this.withLimit(query.orderBy("updatedAt", "desc"), options));
  }
}

class FirestoreDeliveryPlanRepository
  extends BaseFirestoreRepository<CanonicalDeliveryPlan, DeliveryPlanDocument>
  implements DeliveryPlanRepository
{
  async findByIdempotencyKey(input: {
    organizationId: EntityId;
    deliveryType: CanonicalDeliveryPlan["deliveryType"];
    idempotencyKey: string;
  }): Promise<CanonicalDeliveryPlan | null> {
    const result = await this.listFromQuery(
      this.collection
        .where("organizationId", "==", input.organizationId)
        .where("deliveryType", "==", input.deliveryType)
        .where("idempotencyKey", "==", input.idempotencyKey)
        .where("isDeleted", "==", false)
        .limit(1),
    );
    return result.items[0] ?? null;
  }

  async findActiveForRecipient(input: {
    organizationId: EntityId;
    deliveryType: CanonicalDeliveryPlan["deliveryType"];
    sourceEscalationId: EntityId;
    sourceEscalationStageNumber: number | null;
    recipientId: EntityId;
    channel: CanonicalDeliveryPlan["channel"];
  }): Promise<CanonicalDeliveryPlan | null> {
    const result = await this.listFromQuery(
      this.collection
        .where("organizationId", "==", input.organizationId)
        .where("deliveryType", "==", input.deliveryType)
        .where("sourceEscalationId", "==", input.sourceEscalationId)
        .where("recipientId", "==", input.recipientId)
        .where("channel", "==", input.channel)
        .where("isDeleted", "==", false)
        .orderBy("createdAt", "desc")
        .limit(25),
    );
    return (
      result.items.find(
        (item) =>
          item.sourceEscalationStageNumber === input.sourceEscalationStageNumber &&
          (item.status === "planned" || item.status === "scheduled"),
      ) ?? null
    );
  }

  listByOrganizationId(
    organizationId: EntityId,
    options: RepositoryListOptions & {
      statuses?: readonly CanonicalDeliveryPlan["status"][];
      channel?: CanonicalDeliveryPlan["channel"];
      deliveryType?: CanonicalDeliveryPlan["deliveryType"];
    } = {},
  ): Promise<RepositoryListResult<CanonicalDeliveryPlan>> {
    const query = this.collection
      .where("organizationId", "==", organizationId)
      .where("isDeleted", "==", false)
      .orderBy("createdAt", "desc");
    return this.listFromQuery(this.withLimit(query, options)).then((result) => ({
      ...result,
      items: result.items
        .filter((item) => (options.statuses?.length ? options.statuses.includes(item.status) : true))
        .filter((item) => (options.channel ? item.channel === options.channel : true))
        .filter((item) => (options.deliveryType ? item.deliveryType === options.deliveryType : true)),
    }));
  }

  listByEscalation(input: {
    organizationId: EntityId;
    sourceEscalationId: EntityId;
    limit?: number;
  }): Promise<RepositoryListResult<CanonicalDeliveryPlan>> {
    return this.listFromQuery(
      this.collection
        .where("organizationId", "==", input.organizationId)
        .where("sourceEscalationId", "==", input.sourceEscalationId)
        .where("isDeleted", "==", false)
        .orderBy("createdAt", "desc")
        .limit(input.limit ?? 200),
    );
  }
}

class FirestoreDeliveryAttemptRepository
  extends BaseFirestoreRepository<DeliveryAttempt, DeliveryAttemptDocument>
  implements DeliveryAttemptRepository
{
  async findByIdempotencyKey(input: {
    organizationId: EntityId;
    deliveryPlanId: EntityId;
    idempotencyKey: string;
  }): Promise<DeliveryAttempt | null> {
    const result = await this.listFromQuery(
      this.collection
        .where("organizationId", "==", input.organizationId)
        .where("deliveryPlanId", "==", input.deliveryPlanId)
        .where("idempotencyKey", "==", input.idempotencyKey)
        .where("isDeleted", "==", false)
        .limit(1),
    );
    return result.items[0] ?? null;
  }

  listByDeliveryPlanId(input: {
    organizationId: EntityId;
    deliveryPlanId: EntityId;
    limit?: number;
  }): Promise<RepositoryListResult<DeliveryAttempt>> {
    return this.listFromQuery(
      this.collection
        .where("organizationId", "==", input.organizationId)
        .where("deliveryPlanId", "==", input.deliveryPlanId)
        .where("isDeleted", "==", false)
        .orderBy("createdAt", "desc")
        .limit(input.limit ?? 200),
    );
  }

  listByOrganizationId(
    organizationId: EntityId,
    options: RepositoryListOptions & {
      statuses?: readonly DeliveryAttempt["status"][];
      channel?: DeliveryAttempt["channel"];
      adapterType?: DeliveryAttempt["adapterType"];
    } = {},
  ): Promise<RepositoryListResult<DeliveryAttempt>> {
    const query = this.collection
      .where("organizationId", "==", organizationId)
      .where("isDeleted", "==", false)
      .orderBy("createdAt", "desc");
    return this.listFromQuery(this.withLimit(query, options)).then((result) => ({
      ...result,
      items: result.items
        .filter((item) => (options.statuses?.length ? options.statuses.includes(item.status) : true))
        .filter((item) => (options.channel ? item.channel === options.channel : true))
        .filter((item) => (options.adapterType ? item.adapterType === options.adapterType : true)),
    }));
  }
}

class FirestoreDomainEventRepository
  extends BaseFirestoreRepository<DomainEvent, DomainEventDocument>
  implements DomainEventRepository
{
  listByOrganizationId(
    organizationId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<DomainEvent>> {
    const query = this.collection
      .where("organizationId", "==", organizationId)
      .where("isDeleted", "==", false)
      .orderBy("occurredAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }

  listByWorkOrderId(
    workOrderId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<DomainEvent>> {
    const query = this.collection
      .where("workOrderId", "==", workOrderId)
      .orderBy("occurredAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }

  listByEntity(
    entity: DomainEvent["entity"],
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<DomainEvent>> {
    const query = this.collection
      .where("entity.entityType", "==", entity.entityType)
      .where("entity.entityId", "==", entity.entityId)
      .orderBy("occurredAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }
}

class FirestoreTransitionEventRepository
  extends BaseFirestoreRepository<TransitionEvent, TransitionEventDocument>
  implements TransitionEventRepository
{
  listByWorkOrderId(
    workOrderId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<TransitionEvent>> {
    const query = this.collection
      .where("workOrderId", "==", workOrderId)
      .orderBy("occurredAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }
}

class FirestoreTransitionAuditRepository
  extends BaseFirestoreRepository<TransitionAudit, TransitionAuditDocument>
  implements TransitionAuditRepository
{
  listByWorkOrderId(
    workOrderId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<TransitionAudit>> {
    const query = this.collection
      .where("workOrderId", "==", workOrderId)
      .orderBy("occurredAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }
}

class FirestoreIntakeEventRepository
  extends BaseFirestoreRepository<IntakeEvent, IntakeEventDocument>
  implements IntakeEventRepository
{
  listByOrganizationId(
    organizationId: EntityId,
    options: RepositoryListOptions & {
      status?: IntakeEvent["status"];
    } = {},
  ): Promise<RepositoryListResult<IntakeEvent>> {
    let query: Query<DocumentData> = this.collection
      .where("organizationId", "==", organizationId)
      .where("isDeleted", "==", false);

    if (options.status) {
      query = query.where("status", "==", options.status);
    }

    query = query.orderBy("receivedAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }
}

class FirestoreIntakeArtifactRepository
  extends BaseFirestoreRepository<IntakeArtifact, IntakeArtifactDocument>
  implements IntakeArtifactRepository
{
  listByIntakeEventId(
    intakeEventId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<IntakeArtifact>> {
    const query = this.collection
      .where("intakeEventId", "==", intakeEventId)
      .where("isDeleted", "==", false)
      .orderBy("createdAt", "asc");
    return this.listFromQuery(this.withLimit(query, options));
  }
}

class FirestoreAiIntakeDraftRepository
  extends BaseFirestoreRepository<AiIntakeDraft, AiIntakeDraftDocument>
  implements AiIntakeDraftRepository
{
  listByIntakeEventId(
    intakeEventId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<AiIntakeDraft>> {
    const query = this.collection
      .where("intakeEventId", "==", intakeEventId)
      .where("isDeleted", "==", false)
      .orderBy("generatedAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }

  listPendingReview(
    organizationId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<AiIntakeDraft>> {
    const reviewStatuses = [
      "pending_review",
      "escalated",
    ] as const satisfies readonly AiIntakeDraft["reviewStatus"][];
    const query = this.collection
      .where("organizationId", "==", organizationId)
      .where("reviewStatus", "in", reviewStatuses)
      .where("isDeleted", "==", false)
      .orderBy("generatedAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }
}

class FirestoreIntakeApprovalRepository
  extends BaseFirestoreRepository<IntakeApproval, IntakeApprovalDocument>
  implements IntakeApprovalRepository
{
  listByIntakeEventId(
    intakeEventId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<IntakeApproval>> {
    const query = this.collection
      .where("intakeEventId", "==", intakeEventId)
      .where("isDeleted", "==", false)
      .orderBy("createdAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }
}

class FirestoreIntakeDecisionRepository
  extends BaseFirestoreRepository<IntakeDecision, IntakeDecisionDocument>
  implements IntakeDecisionRepository
{
  listByIntakeEventId(
    intakeEventId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<IntakeDecision>> {
    const query = this.collection
      .where("intakeEventId", "==", intakeEventId)
      .where("isDeleted", "==", false)
      .orderBy("createdAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }
}

class FirestoreEscalationOrchestrationRepository
  extends BaseFirestoreRepository<EscalationOrchestration, EscalationOrchestrationDocument>
  implements EscalationOrchestrationRepository
{
  async findByIdempotencyKey(input: {
    organizationId: EntityId;
    escalationType: EscalationOrchestration["escalationType"];
    idempotencyKey: string;
  }): Promise<EscalationOrchestration | null> {
    const query = this.collection
      .where("organizationId", "==", input.organizationId)
      .where("escalationType", "==", input.escalationType)
      .where("idempotencyKey", "==", input.idempotencyKey)
      .where("isDeleted", "==", false)
      .limit(1);
    const snapshot = await query.get();
    const first = snapshot.docs[0];
    return first ? this.fromSnapshot(first) : null;
  }

  async findLatestByTimer(input: {
    organizationId: EntityId;
    escalationType: EscalationOrchestration["escalationType"];
    sourceSlaTimerId: EntityId;
  }): Promise<EscalationOrchestration | null> {
    const result = await this.listFromQuery(
      this.collection
        .where("organizationId", "==", input.organizationId)
        .where("escalationType", "==", input.escalationType)
        .where("sourceSlaTimerId", "==", input.sourceSlaTimerId)
        .where("isDeleted", "==", false)
        .orderBy("createdAt", "desc")
        .limit(5),
    );
    return result.items[0] ?? null;
  }

  async findOpenByCondition(input: {
    organizationId: EntityId;
    escalationType: EscalationOrchestration["escalationType"];
    targetEntityType: EscalationOrchestration["targetEntityType"];
    targetEntityId: EntityId;
  }): Promise<EscalationOrchestration | null> {
    const result = await this.listFromQuery(
      this.collection
        .where("organizationId", "==", input.organizationId)
        .where("escalationType", "==", input.escalationType)
        .where("targetEntityType", "==", input.targetEntityType)
        .where("targetEntityId", "==", input.targetEntityId)
        .where("isDeleted", "==", false)
        .orderBy("createdAt", "desc")
        .limit(10),
    );
    return (
      result.items.find((item) => item.status === "active" || item.status === "completed") ?? null
    );
  }

  listByOrganizationId(
    organizationId: EntityId,
    options: RepositoryListOptions & {
      statuses?: readonly EscalationOrchestration["status"][];
      escalationType?: EscalationOrchestration["escalationType"];
    } = {},
  ): Promise<RepositoryListResult<EscalationOrchestration>> {
    const query = this.collection
      .where("organizationId", "==", organizationId)
      .where("isDeleted", "==", false)
      .orderBy("createdAt", "desc");
    return this.listFromQuery(this.withLimit(query, options)).then((result) => ({
      ...result,
      items: result.items
        .filter((item) => (options.statuses?.length ? options.statuses.includes(item.status) : true))
        .filter((item) => (options.escalationType ? item.escalationType === options.escalationType : true)),
    }));
  }
}

class FirestoreSlaTimerRepository
  extends BaseFirestoreRepository<SlaTimer, SlaTimerDocument>
  implements SlaTimerRepository
{
  async findByIdempotencyKey(input: {
    organizationId: EntityId;
    type: SlaTimer["type"];
    idempotencyKey: string;
  }): Promise<SlaTimer | null> {
    const query = this.collection
      .where("organizationId", "==", input.organizationId)
      .where("type", "==", input.type)
      .where("idempotencyKey", "==", input.idempotencyKey)
      .where("isDeleted", "==", false)
      .limit(1);
    const snapshot = await query.get();
    const first = snapshot.docs[0];
    return first ? this.fromSnapshot(first) : null;
  }

  listByOrganizationId(
    organizationId: EntityId,
    options: RepositoryListOptions & {
      statuses?: readonly SlaTimer["status"][];
      type?: SlaTimer["type"];
    } = {},
  ): Promise<RepositoryListResult<SlaTimer>> {
    const query = this.collection
      .where("organizationId", "==", organizationId)
      .where("isDeleted", "==", false)
      .orderBy("createdAt", "desc");
    return this.listFromQuery(this.withLimit(query, options)).then((result) => ({
      ...result,
      items: result.items
        .filter((item) => (options.statuses?.length ? options.statuses.includes(item.status) : true))
        .filter((item) => (options.type ? item.type === options.type : true)),
    }));
  }

  async scanScheduledDueTimers(input: {
    organizationId: EntityId;
    dueBefore: string;
    limit: number;
    type?: SlaTimer["type"];
    after?: {
      dueAt: string;
      id: EntityId;
    } | null;
  }): Promise<RepositoryListResult<SlaTimer>> {
    let query = this.collection
      .where("organizationId", "==", input.organizationId)
      .where("status", "==", "scheduled")
      .where("dueAt", "<=", toFirestoreTimestamp(input.dueBefore))
      .where("isDeleted", "==", false)
      .orderBy("dueAt", "asc")
      .orderBy(FieldPath.documentId(), "asc")
      .limit(input.limit);

    if (input.after) {
      query = query.startAfter(toFirestoreTimestamp(input.after.dueAt), input.after.id);
    }

    const result = await this.listFromQuery(query);
    return {
      ...result,
      items: result.items.filter((item) => (input.type ? item.type === input.type : true)),
    };
  }
}

class FirestoreSlaScanCursorRepository
  extends BaseFirestoreRepository<SlaScanCursor, SlaScanCursorDocument>
  implements SlaScanCursorRepository
{
  async findByScanType(input: {
    organizationId: EntityId;
    scanType: SlaScanCursor["scanType"];
    timerType?: string | null;
  }): Promise<SlaScanCursor | null> {
    const query = this.collection
      .where("organizationId", "==", input.organizationId)
      .where("scanType", "==", input.scanType)
      .where("timerType", "==", input.timerType ?? null)
      .where("isDeleted", "==", false)
      .limit(1);
    const snapshot = await query.get();
    const first = snapshot.docs[0];
    return first ? this.fromSnapshot(first) : null;
  }

  listByOrganizationId(
    organizationId: EntityId,
    options: RepositoryListOptions & {
      scanType?: SlaScanCursor["scanType"];
    } = {},
  ): Promise<RepositoryListResult<SlaScanCursor>> {
    const query = this.collection
      .where("organizationId", "==", organizationId)
      .where("isDeleted", "==", false)
      .orderBy("updatedAt", "desc");
    return this.listFromQuery(this.withLimit(query, options)).then((result) => ({
      ...result,
      items: result.items.filter((item) => (options.scanType ? item.scanType === options.scanType : true)),
    }));
  }
}

export function createFirestoreRepositories(
  firestore: Firestore = getFirebaseAdminFirestore(),
): FirestoreRepositories {
  return {
    userProfiles: new FirestoreUserProfileRepository(
      firestore,
      FIRESTORE_COLLECTIONS.userProfiles,
      userProfileMapper,
    ),
    contacts: new FirestoreContactRepository(
      firestore,
      FIRESTORE_COLLECTIONS.contacts,
      contactMapper,
    ),
    clientOrganizations: new FirestoreClientOrganizationRepository(
      firestore,
      FIRESTORE_COLLECTIONS.clientOrganizations,
      clientOrganizationMapper,
    ),
    clientOrganizationContactLinks: new FirestoreClientOrganizationContactLinkRepository(
      firestore,
      FIRESTORE_COLLECTIONS.clientOrganizationContactLinks,
      clientOrganizationContactLinkMapper,
    ),
    locations: new FirestoreLocationRepository(
      firestore,
      FIRESTORE_COLLECTIONS.locations,
      locationMapper,
    ),
    locationContactLinks: new FirestoreLocationContactLinkRepository(
      firestore,
      FIRESTORE_COLLECTIONS.locationContactLinks,
      locationContactLinkMapper,
    ),
    contractorOrganizations: new FirestoreContractorOrganizationRepository(
      firestore,
      FIRESTORE_COLLECTIONS.contractorOrganizations,
      contractorOrganizationMapper,
    ),
    contractorContactLinks: new FirestoreContractorContactLinkRepository(
      firestore,
      FIRESTORE_COLLECTIONS.contractorContactLinks,
      contractorContactLinkMapper,
    ),
    workOrders: new FirestoreWorkOrderRepository(
      firestore,
      FIRESTORE_COLLECTIONS.workOrders,
      workOrderMapper,
    ),
    contractorQuotes: new FirestoreContractorQuoteRepository(
      firestore,
      FIRESTORE_COLLECTIONS.contractorQuotes,
      contractorQuoteMapper,
    ),
    clientQuotes: new FirestoreClientQuoteRepository(
      firestore,
      FIRESTORE_COLLECTIONS.clientQuotes,
      clientQuoteMapper,
    ),
    clientInvoices: new FirestoreClientInvoiceRepository(
      firestore,
      FIRESTORE_COLLECTIONS.invoices,
      clientInvoiceMapper,
    ),
    assignments: new FirestoreAssignmentRepository(
      firestore,
      FIRESTORE_COLLECTIONS.assignments,
      assignmentMapper,
    ),
    activityLogs: new FirestoreActivityLogRepository(
      firestore,
      FIRESTORE_COLLECTIONS.activityLogs,
      activityLogMapper,
    ),
    domainEvents: new FirestoreDomainEventRepository(
      firestore,
      FIRESTORE_COLLECTIONS.domainEvents,
      domainEventMapper,
    ),
    transitionEvents: new FirestoreTransitionEventRepository(
      firestore,
      FIRESTORE_COLLECTIONS.transitionEvents,
      transitionEventMapper,
    ),
    transitionAudits: new FirestoreTransitionAuditRepository(
      firestore,
      FIRESTORE_COLLECTIONS.transitionAudits,
      transitionAuditMapper,
    ),
    intakeEvents: new FirestoreIntakeEventRepository(
      firestore,
      FIRESTORE_COLLECTIONS.intakeEvents,
      intakeEventMapper,
    ),
    intakeArtifacts: new FirestoreIntakeArtifactRepository(
      firestore,
      FIRESTORE_COLLECTIONS.intakeArtifacts,
      intakeArtifactMapper,
    ),
    aiIntakeDrafts: new FirestoreAiIntakeDraftRepository(
      firestore,
      FIRESTORE_COLLECTIONS.aiIntakeDrafts,
      aiIntakeDraftMapper,
    ),
    intakeApprovals: new FirestoreIntakeApprovalRepository(
      firestore,
      FIRESTORE_COLLECTIONS.intakeApprovals,
      intakeApprovalMapper,
    ),
    intakeDecisions: new FirestoreIntakeDecisionRepository(
      firestore,
      FIRESTORE_COLLECTIONS.intakeDecisions,
      intakeDecisionMapper,
    ),
    communicationThreads: new FirestoreCommunicationThreadRepository(
      firestore,
      FIRESTORE_COLLECTIONS.communicationThreads,
      communicationThreadMapper,
    ),
    communicationMessages: new FirestoreCommunicationMessageRepository(
      firestore,
      FIRESTORE_COLLECTIONS.communicationMessages,
      communicationMessageMapper,
    ),
    communicationParticipants: new FirestoreCommunicationParticipantRepository(
      firestore,
      FIRESTORE_COLLECTIONS.communicationParticipants,
      communicationParticipantMapper,
    ),
    communicationLinks: new FirestoreCommunicationLinkRepository(
      firestore,
      FIRESTORE_COLLECTIONS.communicationLinks,
      communicationLinkMapper,
    ),
    communicationAttachments: new FirestoreCommunicationAttachmentRepository(
      firestore,
      FIRESTORE_COLLECTIONS.communicationAttachments,
      communicationAttachmentMapper,
    ),
    communicationMatchSuggestions: new FirestoreCommunicationMatchSuggestionRepository(
      firestore,
      FIRESTORE_COLLECTIONS.communicationMatchSuggestions,
      communicationMatchSuggestionMapper,
    ),
    providerConnections: new FirestoreProviderConnectionRepository(
      firestore,
      FIRESTORE_COLLECTIONS.providerConnections,
      providerConnectionMapper,
    ),
    providerSyncCheckpoints: new FirestoreProviderSyncCheckpointRepository(
      firestore,
      FIRESTORE_COLLECTIONS.providerSyncCheckpoints,
      providerSyncCheckpointMapper,
    ),
    providerSyncRuns: new FirestoreProviderSyncRunRepository(
      firestore,
      FIRESTORE_COLLECTIONS.providerSyncRuns,
      providerSyncRunMapper,
    ),
    providerMessageReceipts: new FirestoreProviderMessageReceiptRepository(
      firestore,
      FIRESTORE_COLLECTIONS.providerMessageReceipts,
      providerMessageReceiptMapper,
    ),
    providerThreadMappings: new FirestoreProviderThreadMappingRepository(
      firestore,
      FIRESTORE_COLLECTIONS.providerThreadMappings,
      providerThreadMappingMapper,
    ),
    runtimeJobs: new FirestoreWorkerJobRepository(
      firestore,
      FIRESTORE_COLLECTIONS.runtimeJobs,
      workerJobMapper,
    ),
    runtimeDeadLetters: new FirestoreWorkerDeadLetterRepository(
      firestore,
      FIRESTORE_COLLECTIONS.runtimeDeadLetters,
      workerDeadLetterMapper,
    ),
    runtimeEventProcessings: new FirestoreEventProcessingRepository(
      firestore,
      FIRESTORE_COLLECTIONS.runtimeEventProcessings,
      eventProcessingMapper,
    ),
    deliveryPlans: new FirestoreDeliveryPlanRepository(
      firestore,
      FIRESTORE_COLLECTIONS.deliveryPlans,
      deliveryPlanMapper,
    ),
    deliveryAttempts: new FirestoreDeliveryAttemptRepository(
      firestore,
      FIRESTORE_COLLECTIONS.deliveryAttempts,
      deliveryAttemptMapper,
    ),
    escalationOrchestrations: new FirestoreEscalationOrchestrationRepository(
      firestore,
      FIRESTORE_COLLECTIONS.escalationOrchestrations,
      escalationOrchestrationMapper,
    ),
    slaTimers: new FirestoreSlaTimerRepository(
      firestore,
      FIRESTORE_COLLECTIONS.slaTimers,
      slaTimerMapper,
    ),
    slaScanCursors: new FirestoreSlaScanCursorRepository(
      firestore,
      FIRESTORE_COLLECTIONS.slaScanCursors,
      slaScanCursorMapper,
    ),
    internalNotifications: new FirestoreInternalNotificationRepository(
      firestore,
      FIRESTORE_COLLECTIONS.internalNotifications,
      internalNotificationMapper,
    ),
  };
}
