import "server-only";

import type {
  CollectionReference,
  DocumentData,
  Firestore,
  Query,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { FIRESTORE_COLLECTIONS } from "@/server/repositories/firestore/collections";
import type { FirestoreEntityMapper } from "@/server/repositories/firestore/mappers";
import {
  activityLogMapper,
  assignmentMapper,
  clientQuoteMapper,
  clientOrganizationMapper,
  contractorQuoteMapper,
  contractorOrganizationMapper,
  invoiceMapper,
  internalNotificationMapper,
  locationMapper,
  quoteMapper,
  userProfileMapper,
  workOrderMapper,
} from "@/server/repositories/firestore/mappers";
import type {
  ActivityLog,
  ActivityLogDocument,
  Assignment,
  AssignmentDocument,
  ClientQuote,
  ClientQuoteDocument,
  ClientOrganization,
  ClientOrganizationDocument,
  ContractorQuote,
  ContractorQuoteDocument,
  ContractorOrganization,
  ContractorOrganizationDocument,
  Invoice,
  InvoiceDocument,
  InternalNotification,
  InternalNotificationDocument,
  Location,
  LocationDocument,
  Quote,
  QuoteDocument,
  UserProfile,
  UserProfileDocument,
  WorkOrder,
  WorkOrderDocument,
} from "@/server/repositories/firestore/models";
import { getFirebaseAdminFirestore } from "@/server/firebase";
import type { EntityId } from "@/types/entity";
import type { InvoiceStatus } from "@/types/invoice";
import type { ClientQuoteStatus, ContractorQuoteStatus, QuoteStatus } from "@/types/quote";

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
  listByAssignedCoordinatorUserId(
    coordinatorUserId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<WorkOrder>>;
  listByAssignedManagerUserId(
    managerUserId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<WorkOrder>>;
  listByContractorOrganizationId(
    contractorOrganizationId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<WorkOrder>>;
}

export interface QuoteRepository extends EntityRepository<Quote> {
  listByWorkOrderId(
    workOrderId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<Quote>>;
  listPendingQuotes(options?: RepositoryListOptions): Promise<
    RepositoryListResult<Quote>
  >;
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

export interface InvoiceRepository extends EntityRepository<Invoice> {
  listByWorkOrderId(
    workOrderId: EntityId,
    options?: RepositoryListOptions,
  ): Promise<RepositoryListResult<Invoice>>;
  listFinanceQueue(options?: RepositoryListOptions): Promise<
    RepositoryListResult<Invoice>
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

export interface FirestoreRepositories {
  userProfiles: UserProfileRepository;
  clientOrganizations: ClientOrganizationRepository;
  locations: LocationRepository;
  contractorOrganizations: ContractorOrganizationRepository;
  workOrders: WorkOrderRepository;
  contractorQuotes: ContractorQuoteRepository;
  clientQuotes: ClientQuoteRepository;
  quotes: QuoteRepository;
  invoices: InvoiceRepository;
  assignments: AssignmentRepository;
  activityLogs: ActivityLogRepository;
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

  listByAssignedCoordinatorUserId(
    coordinatorUserId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<WorkOrder>> {
    return this.listWorkOrdersByField(
      "assignedCoordinatorUserId",
      coordinatorUserId,
      options,
    );
  }

  listByAssignedManagerUserId(
    managerUserId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<WorkOrder>> {
    return this.listWorkOrdersByField(
      "assignedManagerUserId",
      managerUserId,
      options,
    );
  }

  listByContractorOrganizationId(
    contractorOrganizationId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<WorkOrder>> {
    return this.listWorkOrdersByField(
      "assignedContractorOrganizationId",
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

class FirestoreQuoteRepository
  extends BaseFirestoreRepository<Quote, QuoteDocument>
  implements QuoteRepository
{
  listByWorkOrderId(
    workOrderId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<Quote>> {
    const query = this.collection
      .where("workOrderId", "==", workOrderId)
      .where("isDeleted", "==", false)
      .orderBy("versionNumber", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }

  listPendingQuotes(
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<Quote>> {
    const pendingStatuses = [
      "submitted",
      "under_review",
      "ready_for_client",
    ] as const satisfies readonly QuoteStatus[];
    const query = this.collection
      .where("status", "in", pendingStatuses)
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

class FirestoreInvoiceRepository
  extends BaseFirestoreRepository<Invoice, InvoiceDocument>
  implements InvoiceRepository
{
  listByWorkOrderId(
    workOrderId: EntityId,
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<Invoice>> {
    const query = this.collection
      .where("workOrderId", "==", workOrderId)
      .where("isDeleted", "==", false)
      .orderBy("updatedAt", "desc");
    return this.listFromQuery(this.withLimit(query, options));
  }

  listFinanceQueue(
    options: RepositoryListOptions = {},
  ): Promise<RepositoryListResult<Invoice>> {
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

export function createFirestoreRepositories(
  firestore: Firestore = getFirebaseAdminFirestore(),
): FirestoreRepositories {
  return {
    userProfiles: new FirestoreUserProfileRepository(
      firestore,
      FIRESTORE_COLLECTIONS.userProfiles,
      userProfileMapper,
    ),
    clientOrganizations: new FirestoreClientOrganizationRepository(
      firestore,
      FIRESTORE_COLLECTIONS.clientOrganizations,
      clientOrganizationMapper,
    ),
    locations: new FirestoreLocationRepository(
      firestore,
      FIRESTORE_COLLECTIONS.locations,
      locationMapper,
    ),
    contractorOrganizations: new FirestoreContractorOrganizationRepository(
      firestore,
      FIRESTORE_COLLECTIONS.contractorOrganizations,
      contractorOrganizationMapper,
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
    quotes: new FirestoreQuoteRepository(
      firestore,
      FIRESTORE_COLLECTIONS.quotes,
      quoteMapper,
    ),
    invoices: new FirestoreInvoiceRepository(
      firestore,
      FIRESTORE_COLLECTIONS.invoices,
      invoiceMapper,
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
    internalNotifications: new FirestoreInternalNotificationRepository(
      firestore,
      FIRESTORE_COLLECTIONS.internalNotifications,
      internalNotificationMapper,
    ),
  };
}
