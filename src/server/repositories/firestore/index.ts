import "server-only";

export {
  FIRESTORE_COLLECTIONS,
  FIRESTORE_COLLECTION_STRATEGY,
  FIRESTORE_ID_CONVENTIONS,
} from "@/server/repositories/firestore/collections";
export type {
  FirestoreCollectionName,
} from "@/server/repositories/firestore/collections";
export {
  activityLogMapper,
  assignmentMapper,
  clientOrganizationMapper,
  contractorOrganizationMapper,
  invoiceMapper,
  locationMapper,
  quoteMapper,
  userProfileMapper,
  workOrderMapper,
} from "@/server/repositories/firestore/mappers";
export type {
  FirestoreEntityMapper,
} from "@/server/repositories/firestore/mappers";
export type {
  ActivityLog,
  ActivityLogDocument,
  Assignment,
  AssignmentDocument,
  ClientOrganization,
  ClientOrganizationDocument,
  ContractorOrganization,
  ContractorOrganizationDocument,
  FirestoreContractorOrganizationStatus,
  FirestoreAuditFields,
  FirestoreOrganizationStatus,
  Invoice,
  InvoiceDocument,
  Location,
  LocationDocument,
  Quote,
  QuoteDocument,
  UserProfile,
  UserProfileDocument,
  WorkOrder,
  WorkOrderDocument,
} from "@/server/repositories/firestore/models";
export {
  createFirestoreRepositories,
} from "@/server/repositories/firestore/repositories";
export type {
  ActivityLogRepository,
  AssignmentRepository,
  ClientOrganizationRepository,
  ContractorOrganizationRepository,
  EntityRepository,
  FirestoreRepositories,
  InvoiceRepository,
  LocationRepository,
  QuoteRepository,
  RepositoryListOptions,
  RepositoryListResult,
  RepositoryMutationResult,
  UserProfileRepository,
  WorkOrderRepository,
} from "@/server/repositories/firestore/repositories";
export {
  toFirestoreTimestamp,
  toIsoDateTime,
  toNullableFirestoreTimestamp,
  toNullableIsoDateTime,
} from "@/server/repositories/firestore/timestamps";
export type {
  FirestoreTimestampValue,
} from "@/server/repositories/firestore/timestamps";
